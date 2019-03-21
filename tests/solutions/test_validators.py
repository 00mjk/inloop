from django.core.exceptions import ValidationError
from django.test import TestCase

from constance.test import override_config

from inloop.solutions.validators import _get_allowed_filename_extensions, validate_filenames


@override_config(ALLOWED_FILENAME_EXTENSIONS=".java   ,  .b ,.cpp,  \n.h,\r.py")
class FileNameExtensionValidationTest(TestCase):
    def test_get_allowed_filename_extensions(self):
        filename_extensions = _get_allowed_filename_extensions()
        self.assertEqual([".java", ".b", ".cpp", ".h", ".py"], filename_extensions)

    def test_valid_uploads(self):
        uploads = {
            "HelloWorld.java": "public class HelloWorld {//...}",
            "HelloWorld.b": "+[-[<<[+[--->]-[<<<]]]>>>-]>-.---.>..>.<<<<-.<+.>>>>>.>.<<.<-.",
            "HelloWorld.cpp": "int main() {//...}",
            "HelloWorld.h": "",
            "HelloWorld.py": "print(\"Hello World\")"
        }
        try:
            validate_filenames(uploads)
        except ValidationError as e:
            self.fail("Filename validation should succeed on the "
                      "given files. ({})".format(e.message))

    def test_invalid_uploads(self):
        uploads = {
            "HelloWorld.kt": "class Test {}",
        }
        with self.assertRaises(ValidationError):
            validate_filenames(uploads)

    def test_no_uploads(self):
        with self.assertRaises(ValidationError):
            validate_filenames({})

    def test_case_insensitivity(self):
        uploads = {
            "First.java": "public class First {//...}",
            "Second.JAVA": "public class Second {//...}",
            "Third.jAvA": "public class Third {//...}"
        }
        try:
            validate_filenames(uploads)
        except ValidationError:
            self.fail("Filename validation should be case insensitive")


@override_config(ALLOWED_FILENAME_EXTENSIONS="")
class EmptyAllowedFileNameExtensionsValidationTest(TestCase):
    def test_get_allowed_filename_extensions(self):
        filename_extensions = _get_allowed_filename_extensions()
        self.assertEqual([], filename_extensions)

    def test_uploads(self):
        uploads = {
            "HelloWorld.java": "public class HelloWorld {//...}",
        }
        with self.assertRaises(ValidationError):
            validate_filenames(uploads)
