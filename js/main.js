  (function () {
    'use strict';

    function byId(id) {
      return document.getElementById(id);
    }

    function hideElement(id) {
      var element = byId(id);
      if (element) element.classList.add('hidden');
    }

    function showElement(id) {
      var element = byId(id);
      if (element) element.classList.remove('hidden');
    }

    function hideAllProjectDetails() {
      var container = byId('project-container');
      if (container) {
        container.classList.add('hidden');
        container.innerHTML = '';
      }
    }

    function setBottomNextVisible(isVisible) {
      var next = byId('bottom-next-project');
      if (!next) return;

      next.classList.toggle('hidden', !isVisible);
      next.classList.toggle('block', isVisible);
    }

    function refreshBackgroundVideos(scope) {
      if (!scope) return;

      scope.querySelectorAll('iframe').forEach(function (iframe) {
        if (iframe.src && iframe.src.indexOf('background=1') !== -1) {
          var currentSrc = iframe.src;
          iframe.src = '';
          iframe.src = currentSrc;
        }
      });
    }

    function setupVimeoScrollPlayers(scope) {
      if (!window.Vimeo || !window.Vimeo.Player || typeof IntersectionObserver === 'undefined') return;

      var root = scope || document;
      var vimeoPlayers = root.querySelectorAll('.vimeo-scroll-player iframe');

      var videoObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          var player = new window.Vimeo.Player(entry.target);

          if (entry.isIntersecting) {
            player.play().catch(function () {});
          } else {
            player.pause().catch(function () {});
          }
        });
      }, { threshold: 0.5 });

      vimeoPlayers.forEach(function (iframe) {
        videoObserver.observe(iframe);
      });
    }

    function switchView(viewName, pushHistory) {
      if (pushHistory === undefined) pushHistory = true;

      hideElement('works-section');
      hideElement('about-section');
      hideElement('visual-section');
      hideElement('common-header');
      hideAllProjectDetails();

      var commonHeader = byId('common-header');
      if (commonHeader) {
        commonHeader.classList.toggle('hidden', !(viewName === 'works' || viewName === 'about'));
      }

      showElement(viewName + '-section');
      setBottomNextVisible(false);

      var bottomNav = byId('bottom-nav');
      if (bottomNav) bottomNav.classList.toggle('hidden', viewName === 'about');
      var topNav = byId('top-nav');
if (topNav) {
  topNav.classList.toggle('no-dropdown', viewName === 'about');
}

      if (pushHistory) {
        history.pushState(
          { type: 'view', view: viewName },
          '',
          window.location.pathname
        );
      }
    }

    async function openProject(projectId, pushHistory) {
      if (pushHistory === undefined) pushHistory = true;

      hideElement('works-section');
      hideElement('about-section');
      hideElement('visual-section');
      hideElement('common-header');
      hideAllProjectDetails();
      var topNav = byId('top-nav');
if (topNav) {
  topNav.classList.remove('no-dropdown');
}

      var container = byId('project-container');
      if (!container) return;

      container.classList.remove('hidden');
      container.innerHTML = '';

      try {
        var response = await fetch('./partials/projects/' + projectId + '.html');

        if (!response.ok) {
          container.innerHTML = '<p class="font-bold uppercase">Project not found.</p>';
          return;
        }

        var html = await response.text();
        container.innerHTML = html;

        setBottomNextVisible(true);
        showElement('bottom-nav');
        window.scrollTo({ top: 0, behavior: 'smooth' });

        if (pushHistory) {
          history.pushState(
            { type: 'project', projectId: projectId },
            '',
            window.location.pathname
          );
        }

        setTimeout(function () {
          refreshBackgroundVideos(container);
          setupVimeoScrollPlayers(container);
        }, 50);
      } catch (error) {
        console.error(error);
        container.innerHTML = '<p class="font-bold uppercase">Project failed to load.</p>';
      }
    }

    function expandProjects(event) {
      if (event) event.stopPropagation();

      var extraContainer = byId('extra-projects');
      var dotsBtn = byId('more-dots');

      if (extraContainer) {
        extraContainer.style.maxHeight = '150px';
        extraContainer.style.opacity = '1';
      }

      if (dotsBtn) dotsBtn.style.display = 'none';
    }

    function setupVisualWorksExpansion() {
      document.querySelectorAll('.visual-work-item').forEach(function (item) {
        item.addEventListener('click', function () {
          var isAlreadyExpanded = item.classList.contains('is-expanded');

          document.querySelectorAll('.visual-work-item.is-expanded').forEach(function (expandedItem) {
            expandedItem.classList.remove('is-expanded');
          });

          if (!isAlreadyExpanded) {
            item.classList.add('is-expanded');
          }
        });
      });
    }

    function setupNavigationHandlers() {
      document.querySelectorAll('[data-view]').forEach(function (button) {
        button.addEventListener('click', function () {
          switchView(button.getAttribute('data-view'));
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });
      });

      document.querySelectorAll('[data-project]').forEach(function (button) {
        button.addEventListener('click', function () {
          openProject(button.getAttribute('data-project'));
        });
      });

      var dots = byId('more-dots');
      if (dots) dots.addEventListener('click', expandProjects);
    }

    function setupDropdownReset() {
      var worksNavGroup = byId('works-nav-group');
      if (!worksNavGroup) return;

      worksNavGroup.addEventListener('mouseleave', function () {
        var extraContainer = byId('extra-projects');
        var dotsBtn = byId('more-dots');

        setTimeout(function () {
          if (extraContainer) {
            extraContainer.style.maxHeight = '0';
            extraContainer.style.opacity = '0';
          }

          if (dotsBtn) dotsBtn.style.display = 'block';
        }, 400);
      });
    }

    function setupBottomNavObserver() {
      var bottomNav = byId('bottom-nav');
      var topNav = byId('top-nav');

      if (!bottomNav || !topNav || typeof IntersectionObserver === 'undefined') return;

      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            bottomNav.classList.add('visible');
            topNav.style.transform = 'translateY(-100%)';
            topNav.style.opacity = '0';
            topNav.style.pointerEvents = 'none';
          } else {
            bottomNav.classList.remove('visible');
            topNav.style.transform = 'translateY(0)';
            topNav.style.opacity = '1';
            topNav.style.pointerEvents = 'auto';
          }
        });
      }, { threshold: 0.05 });

      observer.observe(bottomNav);
    }

    function setupBrowserBack() {
      window.addEventListener('popstate', function (event) {
        var state = event.state;

        if (!state) {
          switchView('works', false);
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }

        if (state.type === 'view') {
          switchView(state.view, false);
          window.scrollTo({ top: 0, behavior: 'smooth' });
          return;
        }

        if (state.type === 'project') {
          openProject(state.projectId, false);
        }
      });
    }

    function runTests() {
      console.assert(typeof window.openProject === 'function', 'openProject should be globally available');
      console.assert(typeof window.switchView === 'function', 'switchView should be globally available');
      console.assert(Boolean(byId('works-section')), 'works-section should exist');
      console.assert(Boolean(byId('project-container')), 'project-container should exist');
    }

    window.switchView = switchView;
    window.openProject = openProject;
    window.expandProjects = expandProjects;

    document.addEventListener('DOMContentLoaded', function () {
      setupNavigationHandlers();
      setupDropdownReset();
      setupBottomNavObserver();
      setupBrowserBack();
      setupVimeoScrollPlayers();
      setupVisualWorksExpansion();

      history.replaceState(
        { type: 'view', view: 'works' },
        '',
        window.location.pathname
      );

      switchView('works', false);
      runTests();
    });
  })();