import os
import sys
import json
import time
import base64
import asyncio
import logging
import docker
import redis.asyncio as aioredis
from datetime import datetime
from app.config import settings
from app.database import db_instance, init_db
from app.services.terminal_manager import terminal_manager

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("terminal_worker")

MAX_OUTPUT_SIZE = 1_000_000 # 1MB

class ExecutionWorker:
    def __init__(self):
        self.redis_client = None
        self.docker_client = None

    async def init(self):
        # Initialize database connection
        await init_db()
        self.redis_client = aioredis.from_url(settings.REDIS_URI, decode_responses=True)
        self.docker_client = docker.from_env()
        logger.info("Execution Worker initialized successfully.")

    async def run(self):
        await self.init()
        logger.info("Worker started listening on terminal:execution_queue...")
        while True:
            try:
                # Pop task from Redis queue (blocking list pop)
                task_data = await self.redis_client.blpop("terminal:execution_queue", timeout=5)
                if not task_data:
                    continue
                
                # task_data is a tuple of (key, value)
                task = json.loads(task_data[1])
                asyncio.create_task(self.handle_execution(task))
            except Exception as e:
                logger.error(f"Error popping or launching task: {e}")
                await asyncio.sleep(1)

    async def handle_execution(self, task: dict):
        session_id = task["session_id"]
        user_id = task["user_id"]
        language = task["language"]
        code = task["code"]

        logger.info(f"Starting execution for session {session_id} ({language})")

        # 1. Fetch language specifications from MongoDB
        db = db_instance.db
        lang_info = await db.supported_languages.find_one({"name": language})
        if not lang_info:
            logger.error(f"Language {language} not supported.")
            await terminal_manager.complete_session(session_id, "FAILED")
            return

        docker_image = lang_info["docker_image"]
        filename = lang_info["filename"]
        compile_cmd = lang_info["compile_cmd"]
        run_cmd = lang_info["run_cmd"]

        # Ensure docker image is pulled
        try:
            self.docker_client.images.get(docker_image)
        except docker.errors.ImageNotFound:
            logger.info(f"Image {docker_image} not found. Pulling...")
            await asyncio.to_thread(self.docker_client.images.pull, docker_image)

        # Base64 encode the code for transfer safety
        encoded_code = base64.b64encode(code.encode('utf-8')).decode('utf-8')

        # C/C++ stdout unbuffering utility prefix
        if language in ["c", "cpp"]:
            run_cmd = f"stdbuf -oL -eL {run_cmd}"

        # Construct run script
        # Add -u flag to python for prompt unbuffering
        if language == "python":
            run_cmd = f"python -u {filename}"

        if compile_cmd:
            command = f"sh -c 'echo {encoded_code} | base64 -d > /tmp/{filename} && cd /tmp && {compile_cmd} && {run_cmd}'"
        else:
            command = f"sh -c 'echo {encoded_code} | base64 -d > /tmp/{filename} && cd /tmp && {run_cmd}'"

        container = None
        sock = None
        started_at = time.time()
        last_activity = time.time()
        output_bytes = 0
        status = "RUNNING"

        try:
            # Create container with strict resource/security controls
            container = self.docker_client.containers.create(
                image=docker_image,
                command=command,
                stdin_open=True,
                tty=True, # Allocate PTY
                network_disabled=True,
                mem_limit="256m",
                nano_cpus=int(1.0 * 1e9),
                pids_limit=30,
                read_only=True,
                user="65534:65534", # nobody user UID:GID
                tmpfs={'/tmp': 'size=50M,exec,mode=1777'},
                security_opt=["no-new-privileges"],
                cap_drop=["ALL"],
                ulimits=[
                    docker.types.Ulimit(name='cpu', soft=60, hard=60),
                    docker.types.Ulimit(name='fsize', soft=1048576, hard=1048576)
                ],
                name=f"compiler_sess_{session_id}"
            )

            # Update session status
            await terminal_manager.update_session_status(session_id, "RUNNING", container.id)
            await self.redis_client.publish(f"session_events:{session_id}", json.dumps({
                "type": "status",
                "status": "RUNNING"
            }))

            # Attach standard stream socket
            sock = container.attach_socket(params={'stdin': 1, 'stdout': 1, 'stderr': 1, 'stream': 1})
            sock._sock.setblocking(False)

            # Start container
            container.start()

            # Set up queues and sub-threads
            queue = asyncio.Queue()
            loop = asyncio.get_running_loop()

            # Thread/callback to read from container socket
            def read_socket():
                try:
                    while True:
                        try:
                            # Read raw bytes
                            data = sock._sock.recv(4096)
                            if not data:
                                break
                            loop.call_soon_threadsafe(queue.put_nowait, data)
                        except (BlockingIOError, InterruptedError):
                            time.sleep(0.01)
                            continue
                except Exception as e:
                    logger.debug(f"Socket read loop end: {e}")
                finally:
                    loop.call_soon_threadsafe(queue.put_nowait, None)

            # Launch read worker in thread pool
            asyncio.create_task(asyncio.to_thread(read_socket))

            # Subscribe to stdin channel
            pubsub = self.redis_client.pubsub()
            await pubsub.subscribe(f"session_stdin:{session_id}")

            async def handle_stdin_pubsub():
                nonlocal last_activity
                try:
                    async for message in pubsub.listen():
                        if message["type"] == "message":
                            evt = json.loads(message["data"])
                            if evt.get("type") == "stdin":
                                stdin_data = evt.get("data", "")
                                sock._sock.send(stdin_data.encode('utf-8'))
                                last_activity = time.time()
                                # Temporarily switch back to running on new input
                                nonlocal status
                                if status != "RUNNING":
                                    status = "RUNNING"
                                    await terminal_manager.update_session_status(session_id, "RUNNING")
                                    await self.redis_client.publish(f"session_events:{session_id}", json.dumps({
                                        "type": "status",
                                        "status": "RUNNING"
                                    }))
                            elif evt.get("type") == "terminate":
                                # Immediate stop request
                                break
                except Exception as e:
                    logger.debug(f"Stdin handler error: {e}")

            # Run stdin handler task
            stdin_task = asyncio.create_task(handle_stdin_pubsub())

            # Main event processing loop
            execution_limit_seconds = 60.0
            idle_limit_seconds = 300.0
            timed_out = False
            idle_timed_out = False
            output_exceeded = False

            while True:
                # 1. Check timeouts

                # 2. Check timeouts
                now = time.time()
                if now - started_at > execution_limit_seconds:
                    timed_out = True
                    break
                if now - last_activity > idle_limit_seconds:
                    idle_timed_out = True
                    break

                # 3. Read stdout chunk from queue with timeout
                try:
                    data = await asyncio.wait_for(queue.get(), timeout=0.1)
                    if data is None:
                        # Socket closed
                        break
                    
                    decoded_text = data.decode('utf-8', errors='replace')
                    output_bytes += len(data)

                    # Output limit checks
                    if output_bytes > MAX_OUTPUT_SIZE:
                        output_exceeded = True
                        break

                    # Append history in Redis
                    await self.redis_client.append(f"terminal:session:{session_id}:history", decoded_text)
                    
                    # Publish stdout
                    await self.redis_client.publish(f"session_events:{session_id}", json.dumps({
                        "type": "stdout",
                        "data": decoded_text
                    }))
                    last_activity = time.time()

                    # Dynamic WAITING_FOR_INPUT heuristic check
                    stripped_text = decoded_text.rstrip()
                    if stripped_text and any(stripped_text.endswith(c) for c in [":", "?", ">"]):
                        status = "WAITING_FOR_INPUT"
                        await terminal_manager.update_session_status(session_id, "WAITING_FOR_INPUT")
                        await self.redis_client.publish(f"session_events:{session_id}", json.dumps({
                            "type": "status",
                            "status": "WAITING_FOR_INPUT"
                        }))

                except asyncio.TimeoutError:
                    continue

            # Terminate stdin listener
            stdin_task.cancel()
            await pubsub.unsubscribe(f"session_stdin:{session_id}")

            # Stop container
            try:
                container.reload()
                if container.status != 'exited':
                    container.stop(timeout=1)
            except Exception:
                pass

            # Resolve exit code and status
            try:
                container.reload()
                exit_code = container.attrs['State']['ExitCode']
            except Exception:
                exit_code = -1

            if timed_out:
                status = "TIMEOUT"
                await self.redis_client.publish(f"session_events:{session_id}", json.dumps({
                    "type": "stderr",
                    "data": "\nExecution timeout exceeded"
                }))
            elif idle_timed_out:
                status = "TIMEOUT"
                await self.redis_client.publish(f"session_events:{session_id}", json.dumps({
                    "type": "stderr",
                    "data": "\nSession idle timeout exceeded"
                }))
            elif output_exceeded:
                status = "FAILED"
                await self.redis_client.publish(f"session_events:{session_id}", json.dumps({
                    "type": "stderr",
                    "data": "\nOutput limit exceeded. Execution terminated."
                }))
            elif exit_code == 0:
                status = "COMPLETED"
            else:
                status = "FAILED"

            await self.redis_client.publish(f"session_events:{session_id}", json.dumps({
                "type": "status",
                "status": status
            }))
            await self.redis_client.publish(f"session_events:{session_id}", json.dumps({
                "type": "exit",
                "code": exit_code
            }))

            await terminal_manager.complete_session(session_id, status, exit_code)

        except Exception as e:
            logger.error(f"Error during sandbox run for session {session_id}: {e}")
            await self.redis_client.publish(f"session_events:{session_id}", json.dumps({
                "type": "status",
                "status": "FAILED"
            }))
            await terminal_manager.complete_session(session_id, "FAILED")
        finally:
            if sock:
                try:
                    sock.close()
                except Exception:
                    pass
            if container:
                try:
                    container.remove(force=True)
                except Exception:
                    pass
            # Set history to expire after 5 minutes
            await self.redis_client.expire(f"terminal:session:{session_id}:history", 300)

if __name__ == "__main__":
    worker = ExecutionWorker()
    asyncio.run(worker.run())
