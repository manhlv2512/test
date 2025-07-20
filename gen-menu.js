function generateMenu(menuList, containerId) {
  var container = document.getElementById(containerId);
  container.innerHTML = "";

  menuList.forEach(item => {
    var hasChildren = Array.isArray(item.children) && item.children.length > 0;

    // Tạo menu item
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

      item.children.forEach(child => {
        var link = document.createElement("a");
        link.href = "#";
        link.setAttribute("data-url", child.link);
        link.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          updateIframeLink(child.link);
          setActive(link);
        };

        var childIcon = document.createElement("i");
        childIcon.className = child.icon || "fas fa-link";

        var childLabel = document.createElement("span");
        childLabel.textContent = child.title;

        link.appendChild(childIcon);
        link.appendChild(childLabel);
        submenu.appendChild(link);
      });

      menuItem.addEventListener("click", () => {
        document.querySelectorAll(".submenu").forEach(sm => {
          if (sm !== submenu) sm.style.display = "none";
        });
        submenu.style.display = submenu.style.display === "block" ? "none" : "block";
      });

      container.appendChild(menuItem);
      container.appendChild(submenu);
    } else if (item.link) {
      // Nếu không có children, thêm sự kiện mở link
      menuItem.addEventListener("click", () => {
        updateIframeLink(item.link);
        document.querySelectorAll(".menu-item").forEach(mi => mi.classList.remove("active"));
        menuItem.classList.add("active");
      });

      container.appendChild(menuItem);
    } else {
      container.appendChild(menuItem);
    }
  });
}

function setActive(link) {
  document.querySelectorAll('.submenu a').forEach(a => a.classList.remove('active'));
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