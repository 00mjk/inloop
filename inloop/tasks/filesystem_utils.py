from shutil import rmtree
from glob import glob
from os import listdir, makedirs, path, remove
from os.path import basename, join

from django.conf import settings

EXERCISE_ROOT = join(settings.MEDIA_ROOT, 'exercises')


def get_template_names(task_name):
    p = join(EXERCISE_ROOT, task_name)
    # get all java template files for task, e.g. 'template.java'
    return map(basename, glob(p + path.sep + '*.java'))


def get_unittest_names(task_name):
    p = join(EXERCISE_ROOT, task_name, 'unittests')
    # get all java template files for task, e.g. 'unittest.java'
    return map(basename, glob(p + path.sep + '*.java'))


def del_template(f_name, task_name):
    p = join(EXERCISE_ROOT, task_name)
    remove(join(p, f_name))


def del_unittest(f_name, task_name):
    p = join(EXERCISE_ROOT, task_name, 'unittests')
    remove(path.join(p, f_name))


def del_task_files(task_name):
    p = join(EXERCISE_ROOT, task_name)
    rmtree(p)


def handle_uploaded_unittest(f, task_name):
    p = join(EXERCISE_ROOT, task_name, 'unittests')
    if not path.exists(p):
        makedirs(p)

    with open(join(p, f.name), 'wb+') as destination:
        for chunk in f.chunks():
            destination.write(chunk)


def handle_uploaded_exercise(f, task_name):
    p = join(EXERCISE_ROOT, task_name)
    if not path.exists(p):
        makedirs(p)

    with open(join(p, f.name), 'wb+') as destination:
        for chunk in f.chunks():
            destination.write(chunk)


def get_task_templates(task_name):
    overview = {}
    p = join(EXERCISE_ROOT, task_name)
    # get all java template files for task
    filenames = map(basename, glob(p + path.sep + '*.java'))
    # build dict overview
    for fname in filenames:
        with open(join(p, fname)) as f:
            overview[fname] = f.read()
    return overview


def latest_solution_files(task, username):
    # add a zero to one digit numbers
    leading_zero = lambda n: str(n) if len(n) > 1 else '0' + str(n)
    # find the max integer in a directory
    max_int_in_dir = lambda p: str(max([int(d) for d in listdir(p)]))
    # find the max id after the time part (e.g. 13:04_103)
    max_id_in_dir = lambda p: str(max([int(d[6:]) for d in listdir(p)]))

    overview = {}
    p = join(settings.MEDIA_ROOT, 'solutions', username, task.title)

    if path.exists(p):
        year = max_int_in_dir(p)
        p = join(p, year)
        month = leading_zero(max_int_in_dir(p))
        p = join(p, month)
        day = leading_zero(max_int_in_dir(p))
        p = join(p, day)
        time = filter(lambda x: str(x).endswith(max_id_in_dir(p)), listdir(p))
        p = join(p, time[0])  # filter delivers one element list

        filenames = map(basename, glob(p + path.sep + '*.java'))
        for fname in filenames:
            with open(join(p, fname)) as f:
                overview[fname] = f.read()
    else:
        # display templates
        overview = get_task_templates(task.title)
    return overview