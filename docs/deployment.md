Deployment Manual
=================

**Warning**:
Setting up and operating INLOOP in a production environment requires a solid understanding of
Linux server administration and familiarity with PostgreSQL, Redis and nginx.


Overview
--------

Although INLOOP is a Python application, it cannot simply be installed using `pip install`.
Instead, we use a Git based deployment and perform a checkout of the latest stable code from the
`master` branch.

INLOOP is a divided into several components and depends on multiple third-party components. Each
one will run as a separate operating system process. The following diagram shows their
responsibilities and interactions:

![INLOOP architecture](figures/architecture.png)

Things to note:

- The core components of INLOOP, the web application and the job queue (the blue boxes), are both
  written in Python and communicate with each other via Redis and the PostgreSQL database. The
  former one is used as session store and job broker, the latter one for general persistence.
- Client HTTP requests are first buffered and proxied by nginx, a robust, small and fast webserver
  which, among other advantages, does a better job at handling TLS encryption and serving static
  files than Gunicorn/Python.
- For development purposes, Django's `runserver` command incorporates everything that nginx,
  Gunicorn and PostgreSQL provide in production (the green area).