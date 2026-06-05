import logging
from datetime import datetime

logger = logging.getLogger(__name__)

# Standard starter code boilerplates for each language
STARTER_CODE_TEMPLATES = {
    "python": """import sys

def main():
    # Read input from standard input
    input_data = sys.stdin.read().strip()
    if not input_data:
        return
    # Write your solution here and print the result
    
if __name__ == '__main__':
    main()
""",
    "javascript": """const fs = require('fs');

function main() {
    // Read input from standard input
    const input = fs.readFileSync(0, 'utf-8').trim();
    if (!input) return;
    // Write your solution here and console.log the result
}

main();
""",
    "c": """#include <stdio.h>
#include <stdlib.h>

int main() {
    // Write your solution here reading from standard input
    return 0;
}
""",
    "cpp": """#include <iostream>
#include <string>
using namespace std;

int main() {
    // Write your solution here reading from standard input
    return 0;
}
""",
    "java": """import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        // Write your solution here reading from standard input
    }
}
"""
}

# The 10 seeded challenges
INITIAL_CHALLENGES = [
    {
        "title": "Add Two Numbers",
        "difficulty": "Easy",
        "category": "Math",
        "tags": ["math", "basics"],
        "problem_statement": "Write a program that reads two space-separated integers from standard input and prints their sum.",
        "input_format": "Two space-separated integers A and B.",
        "output_format": "A single integer representing the sum A + B.",
        "constraints": "-10^9 <= A, B <= 10^9",
        "sample_input": "5 7",
        "sample_output": "12",
        "estimated_time_minutes": 5,
        "sample_test_cases": [
            {"input": "5 7", "expected_output": "12"},
            {"input": "-1 1", "expected_output": "0"}
        ],
        "hidden_test_cases": [
            {"input": "100 200", "expected_output": "300"},
            {"input": "-50 -50", "expected_output": "-100"},
            {"input": "1000000000 2000000000", "expected_output": "3000000000"}
        ],
        "points": 20
    },
    {
        "title": "Even or Odd",
        "difficulty": "Easy",
        "category": "Math",
        "tags": ["math", "basics"],
        "problem_statement": "Write a program that reads an integer and prints 'Even' if the number is even, or 'Odd' if the number is odd.",
        "input_format": "A single integer N.",
        "output_format": "Print either 'Even' or 'Odd'.",
        "constraints": "-10^9 <= N <= 10^9",
        "sample_input": "4",
        "sample_output": "Even",
        "estimated_time_minutes": 5,
        "sample_test_cases": [
            {"input": "4", "expected_output": "Even"},
            {"input": "3", "expected_output": "Odd"}
        ],
        "hidden_test_cases": [
            {"input": "0", "expected_output": "Even"},
            {"input": "-5", "expected_output": "Odd"},
            {"input": "1000002", "expected_output": "Even"}
        ],
        "points": 20
    },
    {
        "title": "Palindrome Checker",
        "difficulty": "Easy",
        "category": "Strings",
        "tags": ["strings", "basics"],
        "problem_statement": "Write a program that checks if a given word string is a palindrome. A palindrome reads the same backward as forward (case-sensitive).",
        "input_format": "A single word string.",
        "output_format": "Print 'true' if the word is a palindrome, or 'false' if it is not.",
        "constraints": "Length of the word <= 100 characters.",
        "sample_input": "racecar",
        "sample_output": "true",
        "estimated_time_minutes": 10,
        "sample_test_cases": [
            {"input": "racecar", "expected_output": "true"},
            {"input": "hello", "expected_output": "false"}
        ],
        "hidden_test_cases": [
            {"input": "madam", "expected_output": "true"},
            {"input": "a", "expected_output": "true"},
            {"input": "steponnopets", "expected_output": "true"}
        ],
        "points": 30
    },
    {
        "title": "Largest of Three Numbers",
        "difficulty": "Easy",
        "category": "Loops",
        "tags": ["basics", "logic"],
        "problem_statement": "Write a program that reads three space-separated integers and prints the largest one.",
        "input_format": "Three space-separated integers A, B, and C.",
        "output_format": "The largest integer value.",
        "constraints": "-10^9 <= A, B, C <= 10^9",
        "sample_input": "5 12 9",
        "sample_output": "12",
        "estimated_time_minutes": 5,
        "sample_test_cases": [
            {"input": "5 12 9", "expected_output": "12"},
            {"input": "0 0 1", "expected_output": "1"}
        ],
        "hidden_test_cases": [
            {"input": "-10 -2 -5", "expected_output": "-2"},
            {"input": "100 50 10", "expected_output": "100"},
            {"input": "5 5 5", "expected_output": "5"}
        ],
        "points": 20
    },
    {
        "title": "Reverse String",
        "difficulty": "Easy",
        "category": "Strings",
        "tags": ["strings", "basics"],
        "problem_statement": "Write a program that reads a string from standard input and prints the string reversed.",
        "input_format": "A single line string.",
        "output_format": "The reversed string.",
        "constraints": "Length <= 1000 characters.",
        "sample_input": "hello",
        "sample_output": "olleh",
        "estimated_time_minutes": 5,
        "sample_test_cases": [
            {"input": "hello", "expected_output": "olleh"},
            {"input": "a", "expected_output": "a"}
        ],
        "hidden_test_cases": [
            {"input": "world", "expected_output": "dlrow"},
            {"input": "online-compiler", "expected_output": "relipmoc-enilno"},
            {"input": "12345", "expected_output": "54321"}
        ],
        "points": 20
    },
    {
        "title": "Prime Checker",
        "difficulty": "Medium",
        "category": "Math",
        "tags": ["math", "loops"],
        "problem_statement": "Write a program that reads an integer N (N >= 1) and prints 'PRIME' if N is a prime number, or 'NOT PRIME' otherwise.",
        "input_format": "A single integer N.",
        "output_format": "Print either 'PRIME' or 'NOT PRIME'.",
        "constraints": "1 <= N <= 100000",
        "sample_input": "17",
        "sample_output": "PRIME",
        "estimated_time_minutes": 15,
        "sample_test_cases": [
            {"input": "17", "expected_output": "PRIME"},
            {"input": "4", "expected_output": "NOT PRIME"}
        ],
        "hidden_test_cases": [
            {"input": "1", "expected_output": "NOT PRIME"},
            {"input": "997", "expected_output": "PRIME"},
            {"input": "10000", "expected_output": "NOT PRIME"}
        ],
        "points": 50
    },
    {
        "title": "Factorial Using Recursion",
        "difficulty": "Medium",
        "category": "Recursion",
        "tags": ["recursion", "math"],
        "problem_statement": "Write a program that reads a non-negative integer N and prints its factorial N! using a recursive or iterative function.",
        "input_format": "A single integer N.",
        "output_format": "The factorial value of N.",
        "constraints": "0 <= N <= 12",
        "sample_input": "5",
        "sample_output": "120",
        "estimated_time_minutes": 15,
        "sample_test_cases": [
            {"input": "5", "expected_output": "120"},
            {"input": "0", "expected_output": "1"}
        ],
        "hidden_test_cases": [
            {"input": "1", "expected_output": "1"},
            {"input": "10", "expected_output": "3628800"},
            {"input": "12", "expected_output": "479001600"}
        ],
        "points": 50
    },
    {
        "title": "Armstrong Number",
        "difficulty": "Medium",
        "category": "Loops",
        "tags": ["math", "loops"],
        "problem_statement": "Write a program that reads an integer and prints 'true' if the number is an Armstrong number, or 'false' otherwise. An Armstrong number is a number that is equal to the sum of the cubes of its digits (e.g. 153 = 1^3 + 5^3 + 3^3).",
        "input_format": "A single integer N.",
        "output_format": "Print either 'true' or 'false'.",
        "constraints": "1 <= N <= 10000",
        "sample_input": "153",
        "sample_output": "true",
        "estimated_time_minutes": 15,
        "sample_test_cases": [
            {"input": "153", "expected_output": "true"},
            {"input": "123", "expected_output": "false"}
        ],
        "hidden_test_cases": [
            {"input": "370", "expected_output": "true"},
            {"input": "371", "expected_output": "true"},
            {"input": "407", "expected_output": "true"}
        ],
        "points": 50
    },
    {
        "title": "Fibonacci Optimization",
        "difficulty": "Hard",
        "category": "Recursion",
        "tags": ["recursion", "dynamic-programming"],
        "problem_statement": "Write a program that computes the N-th Fibonacci number. The sequence is F(0) = 0, F(1) = 1, F(N) = F(N-1) + F(N-2). Use optimization to run fast.",
        "input_format": "A single integer N.",
        "output_format": "The integer value representing the N-th Fibonacci number.",
        "constraints": "0 <= N <= 35",
        "sample_input": "10",
        "sample_output": "55",
        "estimated_time_minutes": 30,
        "sample_test_cases": [
            {"input": "10", "expected_output": "55"},
            {"input": "0", "expected_output": "0"}
        ],
        "hidden_test_cases": [
            {"input": "1", "expected_output": "1"},
            {"input": "25", "expected_output": "75025"},
            {"input": "35", "expected_output": "9227465"}
        ],
        "points": 80
    },
    {
        "title": "Binary Search Implementation",
        "difficulty": "Hard",
        "category": "Searching",
        "tags": ["searching", "algorithms"],
        "problem_statement": "Write a program that implements Binary Search. Given a target T on line 1, and a sorted space-separated array of integers on line 2, find the index of T. Return the 0-based index, or -1 if the target is not in the array.",
        "input_format": "Line 1: Target integer T.\\nLine 2: Space-separated sorted list of integers.",
        "output_format": "The index of target T or -1.",
        "constraints": "Array size <= 10000 elements.",
        "sample_input": "12\n2 5 8 12 16 23",
        "sample_output": "3",
        "estimated_time_minutes": 25,
        "sample_test_cases": [
            {"input": "12\n2 5 8 12 16 23", "expected_output": "3"},
            {"input": "10\n2 5 8 12 16 23", "expected_output": "-1"}
        ],
        "hidden_test_cases": [
            {"input": "2\n2 5 8 12 16 23", "expected_output": "0"},
            {"input": "23\n2 5 8 12 16 23", "expected_output": "5"},
            {"input": "50\n1 3 5 7 9 11 13 15 17 19 21 23 25 27 29 31 33 35 37 39 41 43 45 47 49 51", "expected_output": "-1"}
        ],
        "points": 80
    }
]

async def seed_challenges(db):
    try:
        count = await db.coding_challenges.count_documents({})
        if count == 0:
            logger.info("No coding challenges found in database. Seeding 10 starter challenges...")
            for ch in INITIAL_CHALLENGES:
                challenge_doc = {
                    **ch,
                    "version": 1,
                    "status": "active",
                    "supported_languages": ["python", "javascript", "c", "cpp", "java"],
                    "starter_code": STARTER_CODE_TEMPLATES,
                    "success_rate": 0.0,
                    "total_submissions": 0,
                    "total_solves": 0,
                    "created_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                }
                await db.coding_challenges.insert_one(challenge_doc)
            logger.info("Successfully seeded 10 coding challenges!")
        else:
            logger.info(f"Database already has {count} coding challenges. Skipping seed.")
    except Exception as e:
        logger.error(f"Error seeding coding challenges: {e}")
        raise e
