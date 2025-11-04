var iframe, loadingOverlay, loginUrl, baseUrl;
function onloadRootComponent(hostname, logoutUrl) {
  baseUrl = hostname;
  loginUrl = logoutUrl;
  iframe = document.querySelector("iframe[name='contentFrame']");
  loadingOverlay = document.getElementById("iframe-loading");

  iframe.addEventListener("load", function () {
    loadingOverlay.style.display = "none"; // Hide when done loading
    hideUserMenu();
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
    if (item.className) {
      menuItem.className = "menu-item " + item.className;
    }

    if (item.icon) {
      var icon = document.createElement("i");
      icon.className = item.icon || "fas fa-folder";
      menuItem.appendChild(icon);
    }

    var label = document.createElement("span");
    label.textContent = menuName;
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
        var delay = getDelay(item.nodes);
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

function getDelay(nodes) {
  return Math.min(600, nodes.length * 100)
}

function _slideUp($parent, menuItem) {
  var $siblings = $($parent).children(".menu-item.open").not(menuItem);
  $siblings.removeClass("open");
  $siblings.each(function () {
    var sibSubmenu = $(this).next(".submenu");
    var childs = sibSubmenu.children(".menu-item");
    var sibDelay = getDelay(childs);
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
      var childs = $(this).children(".menu-item");
      var sibDelay = getDelay(childs);
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

function logout() {
  // Hiển thị hộp thoại xác nhận
  var confirmed = confirm("Bạn có chắc chắn muốn đăng xuất không?");
  if (!confirmed) return; // Nếu bấm 'Hủy' thì dừng lại

  // Xóa dữ liệu người dùng trong sessionStorage và localStorage
  sessionStorage.clear();
  localStorage.clear();

  // Xóa cookie (nếu có)
  /* document.cookie.split(";").forEach(cookie => {
    var name = cookie.split("=")[0].trim();
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
  }); */

  // Chuyển hướng sang trang đăng nhập
  window.location.href = loginUrl;
}

// Toggle dropdown when clicking the user info area
function toggleUserMenu() {
  var userMenu = document.getElementById("userMenu");
  userMenu.classList.toggle("show");
}

function hideUserMenu(userMenu) {
  if (!userMenu) userMenu = document.getElementById("userMenu");
  userMenu.classList.remove("show");
}

// Listen for click on the trigger
$(document).on("click", ".user-trigger", function () {
  e.stopPropagation(); // Prevent the click from bubbling up (so it won’t close immediately)
  toggleUserMenu();
});

// Close the dropdown when clicking anywhere outside of the user info and the dropdown menu
document.addEventListener("click", function (e) {
  var userMenu = document.getElementById("userMenu");
  var trigger = document.querySelector(".user-trigger");

  // If the click is outside of both the user-trigger and the dropdown-menu, close the dropdown
  if (!userMenu.contains(e.target) && !trigger.contains(e.target)) {
    hideUserMenu(userMenu);
  }
});

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

function escapeHtml(text) {
  return $("<div>").text(text).html();
}

function hideNotify() {
  var el = $(".notifications");
  if (el) el.hide();
}

function renderNotifications(lists) {
  var notifMenu = $(".tpb-header-info #notifMenu");
  notifMenu.empty();

  if (!lists.length) {
    notifMenu.append('<div class="notif-empty">Không có thông báo</div>');
    $("#notif-count").text("");
    return;
  }

  lists.forEach(function (n) {
    // create row item
    notifMenu.append(createNotifyItem(n));
  });

  // update counter (chỉ tính chưa đọc)
  var unreadCount = lists.filter(function (n) { return n.active == 1; }).length;
  unreadCount = unreadCount || "";
  $("#notif-count").text(unreadCount);
}

function updateNotiCount() {
  var unreadCount = $("#notif-count").text() || "1";
  unreadCount = Number(unreadCount);
  var newCount = unreadCount - 1;
  unreadCount = newCount || "";
  $("#notif-count").text(unreadCount);
}

function createNotifyItem(n) {
  // class cho item theo active
  var itemClass = n.active == 1 ? "notif-item unread" : "notif-item read";
  var userId = n.fullName || n.userId || "";
  if (userId) userId = escapeHtml(userId);
  var text = n.content || "";
  if (text) text = escapeHtml(text);
  var tooltip = userId + ": " + text;
  var link = n.linkUrl || "";
  var dataUrl = "";
  if (link) dataUrl = escapeHtml(link);
  var time = n.pushTime || "";
  var transCode = n.transactionCode || "";
  var info = JSON.stringify(n);

  var item = $("<div>")
    .addClass(itemClass)
    .attr("title", tooltip)
    .attr("data-url", dataUrl)
    .on("click", function () {
      if (n.active == 1) {
        $(this).removeClass("unread").addClass("read");
        bpmext.ui.publishEvent("eventReloadNotify", { action: "markRead", data: info, _id: n.id });
        updateNotiCount();
      }
      if (link) window.open(link, transCode);
    });

  item.append(
    '<div class="notif-row">' +
    '<span class="notif-time">' + time + "</span>" +
    '<span class="notif-code">' + transCode + "</span>" +
    "</div>",
    '<div class="notif-text"' +
    '<span class="notif-user">' + userId + ":</span> " + text +
    "</div>"
  );
  return item
}
