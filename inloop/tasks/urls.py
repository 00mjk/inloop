from django.conf.urls import url

from inloop.tasks.views import TaskDetailView, category, index, serve_attachment

app_name = 'tasks'
urlpatterns = [
    url(r'^$', index, name='index'),
    url(r'^category/(?P<slug>[-\w]+)/$', category, name='category'),
    url(r'^detail/(?P<slug_or_name>[-\w]+)/$', TaskDetailView.as_view(), name='detail'),
    url(r'^detail/(?P<slug>[-\w]+)/(?P<path>.*)$', serve_attachment, name='serve_attachment'),
]
