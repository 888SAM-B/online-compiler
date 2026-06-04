import os
import time
import base64
import docker
import logging
from app.config import settings

logger = logging.getLogger(__name__)

def get_docker_client():
    try:
        if settings.DOCKER_HOST:
            return docker.DockerClient(base_url=settings.DOCKER_HOST)
        return docker.from_env()
    except Exception as e:
        logger.error(f"Failed to connect to Docker daemon: {e}")
        raise e

async def execute_code(language_info: dict, code: str) -> dict:
    docker_image = language_info["docker_image"]
    filename = language_info["filename"]
    compile_cmd = language_info["compile_cmd"]
    run_cmd = language_info["run_cmd"]
    
    client = get_docker_client()
    
    # Pre-pull image if it doesn't exist
    try:
        client.images.get(docker_image)
    except docker.errors.ImageNotFound:
        logger.info(f"Image {docker_image} not found locally. Pulling...")
        client.images.pull(docker_image)
        logger.info(f"Image {docker_image} pulled successfully.")
    except Exception as e:
        logger.warning(f"Error checking/pulling image {docker_image}: {e}")
        
    # Base64 encode the code to pass it safely through the shell
    encoded_code = base64.b64encode(code.encode('utf-8')).decode('utf-8')
    
    # Construct container script
    # Write code -> Compile (if needed) -> Run. All stdout/stderr is captured directly via Docker logs.
    if compile_cmd:
        command = (
            f"sh -c 'echo {encoded_code} | base64 -d > /tmp/{filename} && "
            f"cd /tmp && "
            f"({compile_cmd}) && "
            f"({run_cmd})'"
        )
    else:
        command = (
            f"sh -c 'echo {encoded_code} | base64 -d > /tmp/{filename} && "
            f"cd /tmp && "
            f"({run_cmd})'"
        )
        
    container = None
    start_time = time.time()
    timed_out = False
    
    try:
        # Run container in detached mode with security limits
        container = client.containers.run(
            image=docker_image,
            command=command,
            network_mode="none",
            mem_limit=settings.MEM_LIMIT,
            nano_cpus=int(settings.CPU_LIMIT * 1e9),
            pids_limit=30,
            tmpfs={'/tmp': 'size=50M,exec,mode=1777'},
            read_only=True,
            user="nobody",
            detach=True,
            stdout=True,
            stderr=True
        )
        
        # Wait for container with timeout
        timeout = settings.TIMEOUT_LIMIT
        while time.time() - start_time < timeout:
            container.reload()
            if container.status == 'exited':
                break
            time.sleep(0.1)
        else:
            timed_out = True
            try:
                container.kill()
            except Exception:
                pass
                
        execution_time = round(time.time() - start_time, 3)
        
        # Capture standard streams directly from Docker logs
        stdout = container.logs(stdout=True, stderr=False).decode('utf-8', errors='replace')
        stderr = container.logs(stdout=False, stderr=True).decode('utf-8', errors='replace')
        
        # Container exit code
        container.reload()
        exit_code = container.attrs['State']['ExitCode']
        
        # Determine success and build output response
        success = True
        error_msg = ""
        output_msg = stdout
        
        if timed_out:
            success = False
            error_msg = f"Execution Timeout: Code exceeded limits of {timeout} seconds."
            output_msg = ""
        elif exit_code != 0:
            success = False
            error_msg = stderr if stderr else f"Runtime Error (Exit Code: {exit_code})"
        else:
            # Check stderr even on exit code 0 (some warnings might be printed, but they are not failures)
            if stderr:
                error_msg = stderr
                
        return {
            "success": success,
            "output": output_msg,
            "error": error_msg,
            "execution_time": execution_time
        }
        
    except Exception as e:
        logger.error(f"Error during code execution: {e}")
        return {
            "success": False,
            "output": "",
            "error": f"Execution Engine Error: {str(e)}",
            "execution_time": round(time.time() - start_time, 3)
        }
        
    finally:
        # Cleanup container
        if container:
            try:
                container.remove(force=True)
            except Exception as e:
                logger.warning(f"Failed to remove container: {e}")

