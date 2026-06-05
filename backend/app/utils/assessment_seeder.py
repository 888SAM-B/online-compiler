import logging
import random
from datetime import datetime
from bson import ObjectId

logger = logging.getLogger(__name__)

# Basic template generator for MCQ questions to satisfy 100 / 250 pools with 40/40/20 difficulty split
def generate_procedural_questions(assessment_id, language, category, count):
    questions = []
    
    # Determine basic topics based on language/category
    if category == "python_fundamentals":
        topics = [
            ("expression", "Evaluate the value of: {a} + {b} * {c}", lambda a, b, c: str(a + b * c), "Precedence rules apply: multiplication before addition."),
            ("exponent", "Evaluate the value of: {a} ** {b}", lambda a, b, c: str(a ** b), "The ** operator computes the power of a number."),
            ("floor", "Evaluate the value of: {a} // {b}", lambda a, b, c: str(a // b), "The // operator performs floor division, returning the truncated integer."),
            ("modulo", "Evaluate the value of: {a} % {b}", lambda a, b, c: str(a % b), "The % operator returns the remainder of the division."),
            ("list_len", "If my_list = [1, 2, 3] * {a}, what is len(my_list)?", lambda a, b, c: str(3 * a), "Multiplying a list by an integer duplicates its elements."),
            ("string_mult", "If my_str = 'A' * {a}, what is len(my_str)?", lambda a, b, c: str(a), "Multiplying a string duplicates it."),
            ("logical_and", "What is the boolean value of: {a} > {b} and {b} < {c}?", lambda a, b, c: str(a > b and b < c), "Logical and requires both conditions to be true."),
            ("logical_or", "What is the boolean value of: {a} < {b} or {b} > {c}?", lambda a, b, c: str(a < b or b > c), "Logical or requires at least one condition to be true.")
        ]
    elif category == "python_advanced":
        topics = [
            ("lambda", "What does lambda x: x * {a} evaluate to when called with {b}?", lambda a, b, c: str(b * a), "Lambda creates an inline anonymous function."),
            ("list_comprehension", "What is the output of [x * 2 for x in [{a}, {b}, {c}] if x > 2]?", lambda a, b, c: str([x * 2 for x in [a, b, c] if x > 2]), "List comprehension filters and transforms values."),
            ("dict_get", "If d = {{'x': {a}, 'y': {b}}}, what is d.get('z', {c})?", lambda a, b, c: str(c), "The get method returns the default value if the key does not exist."),
            ("set_intersection", "What is len(set([{a}, {b}]) & set([{b}, {c}]))?", lambda a, b, c: str(len({a, b} & {b, c})), "The & operator computes the set intersection."),
            ("set_union", "What is len(set([{a}, {b}]) | set([{b}, {c}]))?", lambda a, b, c: str(len({a, b} | {b, c})), "The | operator computes the set union."),
            ("tuple_unpack", "If a, *b = [{a}, {b}, {c}], what is len(b)?", lambda a, b, c: "2", "Asterisk unpacking captures remaining elements into a list.")
        ]
    elif category == "javascript_fundamentals":
        topics = [
            ("typeof", "What is the output of typeof {a} in JavaScript?", lambda a, b, c: "number", "Number values have the typeof 'number' in JS."),
            ("typeof_str", "What is the output of typeof '{a}' in JavaScript?", lambda a, b, c: "string", "String literals have the typeof 'string' in JS."),
            ("strict_equal", "What is the result of {a} === '{a}' in JavaScript?", lambda a, b, c: "false", "Strict equality checks both value and type."),
            ("loose_equal", "What is the result of '{a}' == {a} in JavaScript?", lambda a, b, c: "true", "Loose equality performs type coercion before comparison."),
            ("array_push", "If let arr = [{a}, {b}]; arr.push({c}); what is arr.length?", lambda a, b, c: "3", "push appends an element and increases array length by 1."),
            ("array_pop", "If let arr = [{a}, {b}, {c}]; arr.pop(); what is arr.length?", lambda a, b, c: "2", "pop removes the last element, decreasing length by 1.")
        ]
    elif category == "javascript_advanced":
        topics = [
            ("closure", "What is the output of (function(x){{return function(y){{return x+y;}}}}({a}))({b})?", lambda a, b, c: str(a + b), "JavaScript nested functions maintain reference closures to lexical scopes."),
            ("promise_resolve", "Which state does a Promise enter after calling resolve()?", lambda a, b, c: "fulfilled", "Resolving a Promise marks it as fulfilled."),
            ("promise_reject", "Which state does a Promise enter after calling reject()?", lambda a, b, c: "rejected", "Rejecting a Promise marks it as rejected."),
            ("json_parse", "What is JSON.parse('{{\"val\": {a}}}').val?", lambda a, b, c: str(a), "JSON.parse converts a JSON-formatted string to a JS object."),
            ("json_stringify", "What is JSON.stringify({{x: {a}}})?", lambda a, b, c: f'{{"x":{a}}}', "JSON.stringify converts a JS object to a JSON string.")
        ]
    elif category == "c_programming":
        topics = [
            ("pointer_deref", "If int x = {a}; int *p = &x; what is the value of *p?", lambda a, b, c: str(a), "The * dereferences the pointer to yield the variable's value."),
            ("sizeof_int", "What does sizeof(char) evaluate to in standard C?", lambda a, b, c: "1", "In C, sizeof(char) is guaranteed to be 1 byte."),
            ("array_index", "If int arr[3] = {{{a}, {b}, {c}}}; what is arr[1]?", lambda a, b, c: str(b), "C arrays are zero-indexed."),
            ("mod_arithmetic", "What is the value of {a} % {b} in standard C?", lambda a, b, c: str(a % b), "The % operator yields the remainder in integer division.")
        ]
    elif category == "cpp_programming":
        topics = [
            ("class_size", "Does an empty class in C++ occupy memory space?", lambda a, b, c: "yes, 1 byte", "An empty class occupies 1 byte to ensure unique instances have unique memory addresses."),
            ("constructor", "Which member function runs automatically when a class instance is created?", lambda a, b, c: "constructor", "Constructors handle object initialization."),
            ("vector_push", "If std::vector<int> v = {{{a}, {b}}}; v.push_back({c}); what is v.size()?", lambda a, b, c: "3", "push_back adds an item and increases vector size."),
            ("virtual_fn", "Which keyword enables runtime polymorphism in C++?", lambda a, b, c: "virtual", "The virtual keyword marks a function for dynamic binding.")
        ]
    elif category == "java_programming":
        topics = [
            ("gc", "Which JVM component manages memory and deletes unused objects automatically?", lambda a, b, c: "garbage collector", "The Garbage Collector manages memory recycling."),
            ("interface", "Can a Java class implement multiple interfaces?", lambda a, b, c: "yes", "Java supports multiple interface inheritance."),
            ("inheritance", "Which keyword is used to establish subclassing inheritance in Java?", lambda a, b, c: "extends", "Classes use extends to inherit from another class."),
            ("string_pool", "What is the result of String s1 = \"{a}\"; String s2 = \"{a}\"; s1 == s2?", lambda a, b, c: "true", "String literals are stored in the shared JVM string pool.")
        ]
    elif category == "data_structures":
        topics = [
            ("stack_op", "Which data structure operates on a Last-In, First-Out (LIFO) model?", lambda a, b, c: "Stack", "Stacks push and pop elements from the same end (LIFO)."),
            ("queue_op", "Which data structure operates on a First-In, First-Out (FIFO) model?", lambda a, b, c: "Queue", "Queues insert at the rear and remove from the front (FIFO)."),
            ("linked_list_search", "What is the time complexity to search an element in a singly linked list?", lambda a, b, c: "O(N)", "Linked lists require linear scans to find elements in the worst case."),
            ("binary_tree_depth", "What is the maximum number of nodes at depth d in a binary tree?", lambda a, b, c: "2^d", "Each level duplicates the potential node count in binary trees.")
        ]
    elif category == "algorithms":
        topics = [
            ("binary_search_complexity", "What is the worst-case time complexity of Binary Search?", lambda a, b, c: "O(log N)", "Binary search cuts search space in half at each step."),
            ("bubble_sort_complexity", "What is the worst-case time complexity of Bubble Sort?", lambda a, b, c: "O(N^2)", "Bubble sort has nested comparisons over items."),
            ("merge_sort_type", "What divide-and-conquer algorithm has stable sorting with O(N log N)?", lambda a, b, c: "Merge Sort", "Merge sort divides, sorts, and merges stably."),
            ("recursion_base", "What condition stops infinite recursive calls in an algorithm?", lambda a, b, c: "base case", "The base case defines recursion exit criteria.")
        ]
    else: # master / default
        topics = [
            ("master_ds", "Which data structure is best suited for fast index-based lookups?", lambda a, b, c: "Array", "Arrays allow O(1) random access by index."),
            ("master_alg", "What is the average time complexity of Quick Sort?", lambda a, b, c: "O(N log N)", "Quick sort averages O(N log N) using pivoting partitioning."),
            ("master_oop", "What concept hides internal object details and exposes public interfaces?", lambda a, b, c: "Encapsulation", "Encapsulation wraps properties and restricts access."),
            ("master_mem", "What region of memory is dynamically allocated at runtime?", lambda a, b, c: "Heap", "Heap memory supports runtime dynamic allocations.")
        ]

    for i in range(1, count + 1):
        # 40% Easy (1-40), 40% Medium (41-80), 20% Hard (81-100/250)
        if i <= int(count * 0.40):
            difficulty = "easy"
        elif i <= int(count * 0.80):
            difficulty = "medium"
        else:
            difficulty = "hard"

        # Dynamically randomize parameters for formula generators
        a = i + 2
        b = i * 2 + 1
        c = i + 7

        topic = topics[(i - 1) % len(topics)]
        key_name, text_tmpl, answer_fn, explanation_text = topic
        
        # Build question text and calculate answer
        question_text = text_tmpl.format(a=a, b=b, c=c)
        correct_ans = answer_fn(a, b, c)

        # Build options: correct answer plus three fake ones
        options = [correct_ans]
        if correct_ans.isdigit():
            # Integer fake options
            val = int(correct_ans)
            options.append(str(val + random.randint(1, 3)))
            options.append(str(val - random.randint(1, 3)))
            options.append(str(val + random.randint(4, 7)))
        elif correct_ans in ["true", "false"]:
            options = ["true", "false", "undefined", "null"]
        elif correct_ans in ["yes", "no", "extends", "implements", "fulfilled", "rejected", "garbage collector", "Stack", "Queue"]:
            options = [correct_ans, "other", "none", "all"]
        else:
            # Add string modifications
            options.append(correct_ans + " (modified)")
            options.append(correct_ans + " (copy)")
            options.append("None of the above")

        # Make sure options are unique and shuffle them
        options = list(set(options))
        # Ensure we have exactly 4 options
        while len(options) < 4:
            options.append(f"Option {len(options) + 1}")
        options = options[:4]
        if correct_ans not in options:
            options[random.randint(0, 3)] = correct_ans

        questions.append({
            "_id": ObjectId(),
            "assessment_id": assessment_id,
            "question_text": f"[{i}] {question_text}",
            "question_type": "mcq",
            "options": options,
            "correct_answer": correct_ans,
            "difficulty": difficulty,
            "explanation": explanation_text,
            "points": 1,
            "active": True,
            "created_at": datetime.utcnow()
        })

    return questions

async def seed_assessments(db):
    try:
        # Check if assessments are already seeded
        assess_count = await db.assessments.count_documents({})
        if assess_count > 0:
            logger.info("Assessments already seeded. Skipping seeder.")
            return

        logger.info("Starting Assessments & Certification Platform database seeding...")

        # Setup standard assessment profiles
        assessment_templates = [
            {
                "title": "Python Fundamentals",
                "description": "Fundamental concepts of Python programming including variables, loops, types, lists, and functions.",
                "assessment_type": "language",
                "language": "python",
                "duration_minutes": 60,
                "questions_per_attempt": 30,
                "question_pool_size": 100,
                "passing_percentage": 50,
                "max_attempts": 3,
                "cooldown_hours": 24,
                "badge_rules": {"gold": 90, "silver": 75, "bronze": 50},
                "category": "python_fundamentals"
            },
            {
                "title": "Python Advanced",
                "description": "Advanced programming features of Python: set theory, lambda structures, closures, unpacking, and dict tools.",
                "assessment_type": "language",
                "language": "python",
                "duration_minutes": 60,
                "questions_per_attempt": 30,
                "question_pool_size": 100,
                "passing_percentage": 50,
                "max_attempts": 3,
                "cooldown_hours": 24,
                "badge_rules": {"gold": 90, "silver": 75, "bronze": 50},
                "category": "python_advanced"
            },
            {
                "title": "JavaScript Fundamentals",
                "description": "Basic concepts of Node.js and client-side JavaScript including types, loose vs strict equality, and arrays.",
                "assessment_type": "language",
                "language": "javascript",
                "duration_minutes": 60,
                "questions_per_attempt": 30,
                "question_pool_size": 100,
                "passing_percentage": 50,
                "max_attempts": 3,
                "cooldown_hours": 24,
                "badge_rules": {"gold": 90, "silver": 75, "bronze": 50},
                "category": "javascript_fundamentals"
            },
            {
                "title": "JavaScript Advanced",
                "description": "Advanced asynchronous JavaScript, scopes, closures, JSON serialization, and Promise configurations.",
                "assessment_type": "language",
                "language": "javascript",
                "duration_minutes": 60,
                "questions_per_attempt": 30,
                "question_pool_size": 100,
                "passing_percentage": 50,
                "max_attempts": 3,
                "cooldown_hours": 24,
                "badge_rules": {"gold": 90, "silver": 75, "bronze": 50},
                "category": "javascript_advanced"
            },
            {
                "title": "C Programming",
                "description": "C Language constructs, dereferencing, pointers, array allocations, arithmetic, and sizeof checks.",
                "assessment_type": "language",
                "language": "c",
                "duration_minutes": 60,
                "questions_per_attempt": 30,
                "question_pool_size": 100,
                "passing_percentage": 50,
                "max_attempts": 3,
                "cooldown_hours": 24,
                "badge_rules": {"gold": 90, "silver": 75, "bronze": 50},
                "category": "c_programming"
            },
            {
                "title": "C++ Programming",
                "description": "C++ templates, standard vector allocations, constructor rules, dynamic bindings, and runtime polymorphism.",
                "assessment_type": "language",
                "language": "cpp",
                "duration_minutes": 60,
                "questions_per_attempt": 30,
                "question_pool_size": 100,
                "passing_percentage": 50,
                "max_attempts": 3,
                "cooldown_hours": 24,
                "badge_rules": {"gold": 90, "silver": 75, "bronze": 50},
                "category": "cpp_programming"
            },
            {
                "title": "Java Programming",
                "description": "Java VM architectures, interface inheritance, extensibility frameworks, garbage collection, and String pools.",
                "assessment_type": "language",
                "language": "java",
                "duration_minutes": 60,
                "questions_per_attempt": 30,
                "question_pool_size": 100,
                "passing_percentage": 50,
                "max_attempts": 3,
                "cooldown_hours": 24,
                "badge_rules": {"gold": 90, "silver": 75, "bronze": 50},
                "category": "java_programming"
            },
            {
                "title": "Data Structures",
                "description": "Mastering queues, stack frameworks, linked list indexes, and binary tree sizes.",
                "assessment_type": "language",
                "language": "all",
                "duration_minutes": 75,
                "questions_per_attempt": 40,
                "question_pool_size": 100,
                "passing_percentage": 50,
                "max_attempts": 3,
                "cooldown_hours": 24,
                "badge_rules": {"gold": 90, "silver": 75, "bronze": 50},
                "category": "data_structures"
            },
            {
                "title": "Algorithms",
                "description": "Algorithmic execution times, sorting complexities, binary division search structures, and base exit criteria.",
                "assessment_type": "language",
                "language": "all",
                "duration_minutes": 75,
                "questions_per_attempt": 40,
                "question_pool_size": 100,
                "passing_percentage": 50,
                "max_attempts": 3,
                "cooldown_hours": 24,
                "badge_rules": {"gold": 90, "silver": 75, "bronze": 50},
                "category": "algorithms"
            },
            {
                "title": "Master Programming Assessment",
                "description": "Global certification covering basic logic, arrays, complexity calculations, object models, and heaps allocations.",
                "assessment_type": "master",
                "language": "all",
                "duration_minutes": 90,
                "questions_per_attempt": 50,
                "question_pool_size": 250,
                "passing_percentage": 50,
                "max_attempts": 3,
                "cooldown_hours": 24,
                "badge_rules": {"gold": 90, "silver": 75, "bronze": 50},
                "category": "master"
            }
        ]

        # Seed assessments
        for template in assessment_templates:
            category = template.pop("category")
            assessment_id = ObjectId()
            
            # Create assessment document
            doc = {
                "_id": assessment_id,
                "title": template["title"],
                "description": template["description"],
                "assessment_type": template["assessment_type"],
                "language": template["language"],
                "duration_minutes": template["duration_minutes"],
                "questions_per_attempt": template["questions_per_attempt"],
                "question_pool_size": template["question_pool_size"],
                "passing_percentage": template["passing_percentage"],
                "max_attempts": template["max_attempts"],
                "cooldown_hours": template["cooldown_hours"],
                "badge_rules": template["badge_rules"],
                "active": True,
                "question_pool_version": 1,
                "created_by": "admin",
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
            
            await db.assessments.insert_one(doc)
            logger.info(f"Seeded assessment: {doc['title']} (ID: {assessment_id})")

            # Generate questions
            pool_size = doc["question_pool_size"]
            questions = generate_procedural_questions(assessment_id, doc["language"], category, pool_size)
            await db.assessment_questions.insert_many(questions)
            logger.info(f"Seeded {len(questions)} questions for: {doc['title']}")

        logger.info("Database seeding for Assessments successfully finished!")
    except Exception as e:
        logger.error(f"Error seeding assessments: {e}")
