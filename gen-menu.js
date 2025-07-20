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

      // Recursive call
      buildMenuTree(item.children, submenu);

      menuItem.addEventListener("click", function (e) {
        e.stopPropagation();
        var isVisible = submenu.style.display === "block";
        submenu.style.display = isVisible ? "none" : "block";

        toggleIcon.classList.remove("fa-chevron-down", "fa-chevron-up");
        toggleIcon.classList.add(isVisible ? "fa-chevron-down" : "fa-chevron-up");
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
  document.querySelectorAll('.submenu a').forEach(function (a) {
    a.classList.remove('active');
  });
  link.classList.add('active');
}

function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("collapsed");
}

function updateIframeLink(url) {
  var iframe = document.querySelector('iframe[name="contentFrame"]');
  if (iframe) {
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