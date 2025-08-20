var iframe, loadingOverlay, loginUrl, baseUrl;
function onloadRootComponent(hostname, logoutUrl) {
  baseUrl = hostname;
  loginUrl = logoutUrl;
  iframe = document.querySelector("iframe[name='contentFrame']");
  loadingOverlay = document.getElementById("iframe-loading");

  iframe.addEventListener("load", function () {
    loadingOverlay.style.display = "none"; // Hide when done loading
  });
}

function generateMenu(menuList, containerId) {
  var container = document.getElementById(containerId);
  container.innerHTML = "";
  buildMenuTree(menuList, container);
}

function buildMenuTree(items, parentElement) {
  items.forEach(function (item) {
    // Chỉ render nếu có quyền
    if (item.hasPermission !== 1) return;

    var hasNodes = item.nodes && Array.isArray(item.nodes) && item.nodes.length > 0;
    var menuItem = document.createElement("div");
    var menuName = item.menuName || item.title;
    menuItem.className = "menu-item";
    menuItem.setAttribute("data-tooltip", menuName);

    var icon = document.createElement("i");
    icon.className = item.icon || "fas fa-folder";

    var label = document.createElement("span");
    label.textContent = menuName;

    menuItem.appendChild(icon);
    menuItem.appendChild(label);

    if (hasNodes) {
      var toggleIcon = document.createElement("span");
      toggleIcon.className = "toggle-icon fas fa-chevron-down";
      menuItem.appendChild(toggleIcon);

      var submenu = document.createElement("div");
      submenu.className = "submenu";
      submenu.style.display = "none";

      buildMenuTree(item.nodes, submenu);

      $(menuItem).on("click", function (e) {
        e.stopPropagation();
        openSidebar();
        // ĐÓNG tất cả submenu khác, nhưng giữ nguyên các submenu cha của menuItem
        _slideUp(parentElement, menuItem);

        var isOpen = $(menuItem).hasClass("open");
        var delay = Math.min(300, item.nodes.length * 100);
        if (!isOpen) {
          $(menuItem).addClass("open");
          $(menuItem).removeClass("active");
          $(submenu).stop(true, true).slideDown(delay, function () {
            $(this).css("display", "block");
          });
          toggleIcon.className = "toggle-icon fas fa-chevron-up";
        } else {
          $(menuItem).removeClass("open");
          var hasActiveChild = $(submenu).find('.menu-item.active').length > 0;
          if (hasActiveChild) {
            menuItem.classList.add("active");
          } else {
            menuItem.classList.remove("active");
          }
          $(submenu).find('.menu-item.open').removeClass('open');
          $(submenu).stop(true, true).slideUp(delay, function () {
            $(this).css("display", "none");
          });
          toggleIcon.className = "toggle-icon fas fa-chevron-down";
        }
      });

      parentElement.appendChild(menuItem);
      parentElement.appendChild(submenu);
    } else {
      if (item.linkUrl || item.link) {
        menuItem.classList.add("has-link");
        menuItem.addEventListener("click", function (e) {
          e.stopPropagation();
          setActive(menuItem);
          // ĐÓNG tất cả submenu đang mở
          _slideUp(parentElement, menuItem);
          // _slideUp(submenu);
          updateIframeLink(item.linkUrl || item.link);
        });
      }
      parentElement.appendChild(menuItem);
    }
  });
}

function openSidebar() {
  var sidebar = document.getElementById("sidebar");
  if (sidebar.classList.contains("collapsed")) {
    sidebar.classList.remove("collapsed");
    sidebar.classList.add("force-open");
  }
}

function _slideUp($parent, menuItem) {
  var $siblings = $($parent).children(".menu-item.open").not(menuItem);
  $siblings.removeClass("open");
  $siblings.each(function () {
    var sibSubmenu = $(this).next(".submenu");
    var sibDelay = Math.min(300, sibSubmenu.children(".menu-item").length * 100);
    sibSubmenu.stop(true, true).slideUp(sibDelay, function () {
      $(this).css("display", "none");
    });
    var sibIcon = $(this).find(".toggle-icon");
    if (sibIcon.length) sibIcon.attr("class", "toggle-icon fas fa-chevron-down");
  });
}

function _slideUpAll(submenu) {
  $(".submenu:visible").each(function () {
    var hasActive = $(this).find('.menu-item.active').length > 0;
    // Nếu submenu không chứa menu-item.active và không phải submenu của menuItem vừa click thì đóng
    if (!hasActive && this !== submenu) {
      var parentMenu = $(this).prev(".menu-item");
      parentMenu.removeClass("open");
      var icon = parentMenu.find(".toggle-icon");
      if (icon.length) icon.attr("class", "toggle-icon fas fa-chevron-down");
      // TODO tính toán lại delay theo submenu đang open
      var sibDelay = Math.min(300, $(this).children(".menu-item").length * 100);
      $(this).stop(true, true).slideUp(sibDelay, function () {
        $(this).css("display", "none");
      });
    }
  });
}

// Hàm set active cho menu item
function setActive(element) {
  $(".menu-item").removeClass("active");
  element.classList.add("active");
}

// Hàm cập nhật link cho iframe
function updateIframeLink(url) {
  if (iframe) {
    loadingOverlay.style.display = "flex"; // Show loading
    iframe.src = url;
  }
}

// Toggle sidebar function
function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("collapsed");
}

// Set username
function setAuth(username) {
  document.getElementById("username").textContent = username;
}

// Logout function
function logout() {
  // alert("Logging out...");
  // Optional: clear tokens, sessionStorage, etc.
  // sessionStorage.clear();
  window.location.href = loginUrl; // redirect to login
}

// Thêm sự kiện hover cho menu-item khi sidebar đang đóng
$(document).on("mouseenter", ".menu-item", function () {
  var sidebar = document.getElementById("sidebar");
  if (sidebar.classList.contains("collapsed")) {
    sidebar.classList.remove("collapsed");
    sidebar.classList.add("force-open");
  }
});

$(document).on("mouseleave", ".menu-item", function () {
  var sidebar = document.getElementById("sidebar");
  if (sidebar.classList.contains("force-open")) {
    sidebar.classList.remove("force-open");
    sidebar.classList.add("collapsed");
  }
});