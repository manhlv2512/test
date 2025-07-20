function generateMenu(menuList, containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  const buildMenuTree = (items, parentElement) => {
    items.forEach(item => {
      const hasChildren = Array.isArray(item.children) && item.children.length > 0;

      const menuItem = document.createElement("div");
      menuItem.className = "menu-item";
      menuItem.setAttribute("data-tooltip", item.title);

      const icon = document.createElement("i");
      icon.className = item.icon || "fas fa-folder";

      const label = document.createElement("span");
      label.textContent = item.title;

      menuItem.appendChild(icon);
      menuItem.appendChild(label);

      if (hasChildren) {
        const toggleIcon = document.createElement("span");
        toggleIcon.className = "toggle-icon fas fa-chevron-down";
        menuItem.appendChild(toggleIcon);

        const submenu = document.createElement("div");
        submenu.className = "submenu";

        // Recursive call to handle deeper levels
        buildMenuTree(item.children, submenu);

        // Toggle submenu on click
        menuItem.addEventListener("click", (e) => {
          e.stopPropagation();
          submenu.style.display = submenu.style.display === "block" ? "none" : "block";
        });

        parentElement.appendChild(menuItem);
        parentElement.appendChild(submenu);
      } else if (item.link) {
        menuItem.classList.add("has-link");
        menuItem.addEventListener("click", (e) => {
          e.stopPropagation();
          updateIframeLink(item.link);
          setActive(menuItem);
        });

        parentElement.appendChild(menuItem);
      } else {
        parentElement.appendChild(menuItem);
      }
    });
  };

  buildMenuTree(menuList, container);
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