from django.db import models
from tinymce import models as tinymce_models


class Task(models.Model):
    '''
    Represents the tasks that are presented to the user to solve.
    '''
    title = models.CharField(max_length=100, help_text='Task name')
    author = models.CharField(max_length=100, help_text='Creator of task')
    description = tinymce_models.HTMLField(help_text='Task description')
    publication_date = models.DateTimeField(help_text='When should the task be published?')
    deadline_date = models.DateTimeField(help_text='Date the task is due to')
    BASIC = 'B'
    ADVANCED = 'A'
    LESSON = 'L'
    EXAM = 'E'
    category = models.CharField(max_length=1,
                                choices=(    (BASIC, 'Basic Exercise'),
                                             (ADVANCED, 'Advanced Exercise'),
                                             (LESSON, 'Lesson Exercise'),
                                             (EXAM, 'Exam Exercise')), help_text='Category of task')
    slug = models.SlugField(max_length=50, unique=True, help_text='URL name')

    def task_is_active(self):
        '''
        Returns True if the task is already visible to the users.
        '''
        pass


class TaskFile(models.Model):
    '''
    Represents the files the user has to edit for each task. As each task
    has a different amount of connected files, they were implemented using
    a ForeignKey relationship.

    Access all files connected to a task:
    task = Task.objects.get(pk=1)
    task.task_files.all()
    '''
    filename = models.CharField(max_length=30, help_text='Name of the file including the ending')
    content = tinymce_models.HTMLField()
    task = models.ForeignKey(Task, related_name='task_files')
