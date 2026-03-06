#!/usr/bin/env python3

"""
Seed script to load and validate problem data from JSON files.
Supports validation-only mode and comprehensive error reporting.
"""

import argparse
import json
import logging
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

try:
    from jsonschema import validate, ValidationError as SchemaValidationError
    from jsonschema import Draft7Validator
    HAS_JSONSCHEMA = True
except ImportError:
    HAS_JSONSCHEMA = False
    logging.warning("jsonschema not installed. Install with: pip install jsonschema")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)


class ProblemLoader:
    """Load and validate problem data from JSON files."""

    def __init__(
        self,
        problems_dir: str = "problems",
        schema_path: str = "schema.json",
        validate_only: bool = False,
        verbose: bool = False
    ):
        self.problems_dir = Path(problems_dir)
        self.schema_path = Path(schema_path)
        self.validate_only = validate_only
        self.verbose = verbose
        self.schema: Optional[Dict[str, Any]] = None
        self.validator: Optional[Draft7Validator] = None
        
        # Statistics
        self.total_files = 0
        self.valid_files = 0
        self.invalid_files = 0
        self.errors: List[Tuple[str, str]] = []

    def load_schema(self) -> bool:
        """Load JSON schema for validation."""
        if not self.schema_path.exists():
            logger.error(f"Schema file not found: {self.schema_path}")
            return False

        try:
            with open(self.schema_path, 'r', encoding='utf-8') as f:
                self.schema = json.load(f)
            
            if HAS_JSONSCHEMA:
                self.validator = Draft7Validator(self.schema)
                logger.info(f"Loaded schema from {self.schema_path}")
            else:
                logger.warning("jsonschema not available, skipping schema validation")
            
            return True
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in schema file: {e}")
            return False
        except Exception as e:
            logger.error(f"Failed to load schema: {e}")
            return False

    def validate_problem(self, problem: Dict[str, Any], filename: str) -> List[str]:
        """
        Validate a problem against the schema.
        Returns a list of validation errors.
        """
        errors: List[str] = []

        if not HAS_JSONSCHEMA or not self.validator:
            # Basic validation without jsonschema
            required_fields = ['id', 'title', 'difficulty', 'language', 'description', 'solutionCode']
            for field in required_fields:
                if field not in problem:
                    errors.append(f"Missing required field: {field}")
            return errors

        # Validate against JSON schema
        try:
            self.validator.validate(problem)
        except SchemaValidationError as e:
            errors.append(f"{e.json_path}: {e.message}")

        # Additional custom validations
        if 'id' in problem:
            expected_id = filename.replace('.json', '')
            if problem['id'] != expected_id:
                errors.append(
                    f"ID mismatch: filename is '{expected_id}' but id field is '{problem['id']}'"
                )

        if 'testCases' in problem and len(problem['testCases']) == 0:
            errors.append("No test cases defined")

        return errors

    def find_problem_files(self) -> List[Path]:
        """Recursively find all JSON problem files."""
        if not self.problems_dir.exists():
            logger.error(f"Problems directory not found: {self.problems_dir}")
            return []

        problem_files: List[Path] = []
        
        # Find all .json files recursively
        for root, _, files in os.walk(self.problems_dir):
            for filename in files:
                if filename.endswith('.json'):
                    problem_files.append(Path(root) / filename)

        return problem_files

    def process_problem_file(self, filepath: Path) -> bool:
        """
        Process a single problem file.
        Returns True if valid, False otherwise.
        """
        self.total_files += 1
        filename = filepath.name

        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                problem = json.load(f)
        except json.JSONDecodeError as e:
            error_msg = f"JSON parse error: {e}"
            logger.error(f"❌ {filename}: {error_msg}")
            self.errors.append((filename, error_msg))
            self.invalid_files += 1
            return False
        except Exception as e:
            error_msg = f"Failed to read file: {e}"
            logger.error(f"❌ {filename}: {error_msg}")
            self.errors.append((filename, error_msg))
            self.invalid_files += 1
            return False

        # Validate problem
        validation_errors = self.validate_problem(problem, filename)
        
        if validation_errors:
            logger.error(f"❌ {filename}: Validation failed")
            for error in validation_errors:
                logger.error(f"    - {error}")
                self.errors.append((filename, error))
            self.invalid_files += 1
            return False

        # Success
        if self.verbose:
            logger.info(f"✅ {filename}: Valid")
        
        self.valid_files += 1
        
        # If not validate-only, load into database
        if not self.validate_only:
            # TODO: Implement database insertion
            if self.verbose:
                logger.debug(f"Would insert {filename} into database")

        return True

    def run(self) -> int:
        """
        Run the problem loader.
        Returns exit code (0 for success, 1 for errors).
        """
        logger.info("=" * 60)
        logger.info("Vaera Problem Loader")
        logger.info("=" * 60)
        logger.info("")

        # Load schema
        if not self.load_schema():
            return 1

        # Find problem files
        logger.info(f"Scanning directory: {self.problems_dir}")
        problem_files = self.find_problem_files()
        
        if not problem_files:
            logger.warning("No problem files found")
            return 0

        logger.info(f"Found {len(problem_files)} problem files")
        logger.info("")

        # Process each file
        for filepath in problem_files:
            self.process_problem_file(filepath)

        # Print summary
        logger.info("")
        logger.info("=" * 60)
        logger.info("Summary")
        logger.info("=" * 60)
        logger.info(f"Total files: {self.total_files}")
        logger.info(f"✅ Valid: {self.valid_files}")
        logger.info(f"❌ Invalid: {self.invalid_files}")
        
        if self.validate_only:
            logger.info("Mode: Validation only (no database operations)")
        
        logger.info("=" * 60)

        # Return appropriate exit code
        if self.invalid_files > 0:
            logger.error("❌ Validation failed - fix errors and try again")
            return 1
        else:
            logger.info("✅ All files validated successfully")
            return 0


def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Load and validate problem data from JSON files",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s                      # Load problems into database
  %(prog)s --validate-only      # Only validate, don't load
  %(prog)s -v                   # Verbose output
  %(prog)s --dir problems/Python --schema schema.json
        """
    )
    
    parser.add_argument(
        '--validate-only',
        action='store_true',
        help='Only validate files, do not load into database'
    )
    
    parser.add_argument(
        '--dir',
        type=str,
        default='problems',
        help='Problems directory (default: problems)'
    )
    
    parser.add_argument(
        '--schema',
        type=str,
        default='schema.json',
        help='Schema file path (default: schema.json)'
    )
    
    parser.add_argument(
        '-v', '--verbose',
        action='store_true',
        help='Verbose output'
    )

    args = parser.parse_args()

    # Set log level
    if args.verbose:
        logger.setLevel(logging.DEBUG)

    # Create and run loader
    loader = ProblemLoader(
        problems_dir=args.dir,
        schema_path=args.schema,
        validate_only=args.validate_only,
        verbose=args.verbose
    )

    return loader.run()


if __name__ == "__main__":
    sys.exit(main())