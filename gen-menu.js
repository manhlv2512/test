function generateMenu(menuList, containerId) {
  var container = document.getElementById(containerId);
  container.innerHTML = "";
  buildMenuTree(menuList, container);
}

function buildMenuTree(items, parentElement) {
  items.forEach(function (item) {
    var hasChildren = item.children && Array.isArray(item.children) && item.children.length > 0;

    var menuItem = document.createElement("div");
    menuItem.className = "menu-item";
    menuItem.setAttribute("data-tooltip", item.title);

    var icon = document.createElement("i");
    icon.className = item.icon || "fas fa-folder";

    var label = document.createElement("span");
    label.textContent = item.title;

    menuItem.appendChild(icon);
    menuItem.appendChild(label);

    if (hasChildren) {
      var toggleIcon = document.createElement("span");
      toggleIcon.className = "toggle-icon fas fa-chevron-down";
      menuItem.appendChild(toggleIcon);

      var submenu = document.createElement("div");
      submenu.className = "submenu";
      submenu.style.display = "none"; // Ẩn mặc định

      // Recursive call
      buildMenuTree(item.children, submenu);

      // Tính delay dựa trên số lượng node con
      var delay = Math.min(1200, 400 + item.children.length * 100); // tối đa 1200ms

      $(menuItem).on("click", function (e) {
        e.stopPropagation();
        var $siblings = $(parentElement).children(".menu-item").not(menuItem);
        $siblings.removeClass("open");
        $siblings.each(function () {
          var sibSubmenu = $(this).next(".submenu");
          sibSubmenu.stop(true, true).slideUp(delay);
          var sibIcon = $(this).find(".toggle-icon");
          if (sibIcon.length) sibIcon.attr("class", "toggle-icon fas fa-chevron-down");
        });

        var isOpen = $(menuItem).hasClass("open");
        if (!isOpen) {
          $(menuItem).addClass("open");
          $(submenu).stop(true, true).slideDown(delay, function () {
            $(this).css("display", "block");
          });
          toggleIcon.className = "toggle-icon fas fa-chevron-up";
        } else {
          $(menuItem).removeClass("open");
          // Đóng tất cả submenu con khi đóng parent
          $(submenu).find('.menu-item.open').removeClass('open');
          $(submenu).find('.submenu').stop(true, true).slideUp(delay).css("display", "none");
          $(submenu).stop(true, true).slideUp(delay, function () {
            $(this).css("display", "none");
          });
          toggleIcon.className = "toggle-icon fas fa-chevron-down";
        }
      });

      parentElement.appendChild(menuItem);
      parentElement.appendChild(submenu);
    } else if (item.link) {
      menuItem.classList.add("has-link");

      menuItem.addEventListener("click", function (e) {
        e.stopPropagation();
        updateIframeLink(item.link);
        setActive(menuItem);
      });

      parentElement.appendChild(menuItem);
    } else {
      parentElement.appendChild(menuItem);
    }
  });
}

function setActive(link) {
  document.querySelectorAll('.menu-item.active').forEach(function (a) {
    a.classList.remove('active');
  });
  link.classList.add('active');
}

function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("collapsed");
}

var iframe = document.querySelector("iframe[name='contentFrame']");
var loadingOverlay = document.getElementById("loadingOverlay");

iframe.addEventListener("load", function () {
  loadingOverlay.style.display = "none"; // Hide when done loading
});

function updateIframeLink(url) {
  var iframe = document.querySelector('iframe[name="contentFrame"]');
  if (iframe) {
    loadingOverlay.style.display = "flex"; // Show loading
    iframe.src = url;
  }
}

// Set username
function setAuth(username) {
  document.getElementById("username").textContent = username;
}

// Logout function
function logout() {
  alert("Logging out...");
  // Optional: clear tokens, sessionStorage, etc.
  // sessionStorage.clear();
  // window.location.href = "login.html"; // redirect to login
}