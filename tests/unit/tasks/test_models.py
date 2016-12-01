from doctest import DocTestSuite

from django.core.exceptions import ValidationError
from django.test import TestCase

from inloop.tasks import models
from inloop.tasks.models import Category, Task

from tests.unit.tasks.mixins import TaskData


def load_tests(loader, tests, ignore):
    """Initialize doctests for this module."""
    tests.addTests(DocTestSuite(models))
    return tests


class TaskTests(TaskData, TestCase):
    def test_task_is_published(self):
        self.assertTrue(self.published_task1.is_published())
        self.assertFalse(self.unpublished_task1.is_published())

    def test_invalid_inputs(self):
        with self.assertRaises(ValidationError):
            Task.objects.create(pubdate="abc")

        with self.assertRaises(ValidationError):
            Task.objects.create(deadline="abc")


class TaskCategoryTests(TestCase):
    def test_slugify_on_save(self):
        cat_name = "Whitespace here and 123 some! TABS \t - \"abc\" (things)\n"
        slug = "whitespace-here-and-123-some-tabs-abc-things"
        category = self.create_category(name=cat_name)
        self.assertEqual(category.slug, slug)

    def test_completed_tasks_empty_category(self):
        empty_cat = self.create_category(name="empty")
        self.assertFalse(empty_cat.completed_tasks_for_user(self.user).exists())

    def test_tasks_uncompleted(self):
        solution = self.create_solution()
        self.assertFalse(solution.passed)
        self.assertFalse(self.cat.completed_tasks_for_user(self.user).exists())

    def test_tasks_completed_multiple_solutions(self):
        solution1 = self.create_solution(passed=True)
        solution2 = self.create_solution(passed=True)
        self.assertTrue(solution1.passed)
        self.assertTrue(solution2.passed)
        self.assertEqual(self.cat.completed_tasks_for_user(self.user).count(), 1)
        self.assertEqual(self.cat.completed_tasks_for_user(self.user)[0], self.task)

        task2 = self.create_task(title="Another task")
        solution3 = self.create_solution(task=task2)
        self.assertFalse(solution3.passed)
        self.assertEqual(self.cat.completed_tasks_for_user(self.user).count(), 1)

        solution4 = self.create_solution(task=task2, passed=True)
        self.assertTrue(solution4.passed)
        self.assertEqual(self.cat.completed_tasks_for_user(self.user).count(), 2)


class TaskCategoryManagerTests(TestCase):
    def setUp(self):
        Category.objects.create(name="Test category")

    def test_returns_existing_category(self):
        self.assertEqual(Category.objects.count(), 1)
        category = Category.objects.get_or_create("Test category")
        self.assertEqual(category.name, "Test category")
        self.assertEqual(Category.objects.count(), 1)

    def test_returns_new_category(self):
        self.assertEqual(Category.objects.count(), 1)
        category = Category.objects.get_or_create("Another category")
        self.assertEqual(category.name, "Another category")
        self.assertEqual(Category.objects.count(), 2)


class TaskManagerTests(TestCase):
    def setUp(self):
        self.manager = Task.objects
        self.valid_json = {"title": "Test title", "category": "Lesson",
                           "pubdate": "2015-05-01 13:37:00"}

    def test_validate_empty(self):
        with self.assertRaises(ValueError):
            self.manager._validate(dict())

    def test_validate_valid(self):
        self.manager._validate(self.valid_json)

    def test_update(self):
        input = Task()
        task = self.manager._update_task(input, self.valid_json)

        self.assertIs(task, input)
        self.assertEqual(task.title, "Test title")
        self.assertEqual(task.slug, "test-title")
        self.assertEqual(task.category.name, "Lesson")

        pubdate = task.publication_date.strftime("%Y-%m-%d %H:%M:%S")
        self.assertEqual(pubdate, self.valid_json["pubdate"])

    def test_save_task_with_valid_json(self):
        task = Task.objects.get_or_create_json(self.valid_json, "Test title")
        task.save()
