# Generated by Django 2.2.15 on 2020-09-01 19:44

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('solutions', '0007_merge_20190802_1345'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='checkpoint',
            name='md5',
        ),
    ]
