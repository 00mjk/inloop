from django.db import models
from django.utils import timezone
from accounts.models import UserProfile


def generate_short_id(s):
    s = ''.join(e for e in s if e.isalnum())
    return s.lower()


class TaskCategory(models.Model):
    def save(self, *args, **kwargs):
        s = getattr(self, 'name')
        setattr(self, 'short_id', generate_short_id(s))
        super(TaskCategory, self).save(*args, **kwargs)

    short_id = models.CharField(
        unique=True,
        max_length=50,
        help_text='Short ID for URLs')
    name = models.CharField(
        unique=True,
        max_length=50,
        help_text='Category Name')

    def get_tuple(self):
        return (self.short_id, self.name)

    def __str__(self):
        return self.short_id


class Task(models.Model):
    '''
    Represents the tasks that are presented to the user to solve.
    '''

    title = models.CharField(
        max_length=100,
        help_text='Task name')
    author = models.ForeignKey(
        UserProfile)
    description = models.TextField(
        help_text='Task description')
    publication_date = models.DateTimeField(
        help_text='When should the task be published?')
    deadline_date = models.DateTimeField(
        help_text='Date the task is due to')
    category = models.ForeignKey(TaskCategory)
    slug = models.SlugField(
        max_length=50,
        unique=True,
        help_text='URL name')

    def is_active(self):
        '''
        Returns True if the task is already visible to the users.
        '''

        return timezone.now() > self.publication_date
