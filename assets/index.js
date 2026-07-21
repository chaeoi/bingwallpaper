function clampPage(page, totalPages) {
  const parsedPage = Number.parseInt(page, 10);
  const validPage =
    Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  return Math.min(validPage, Math.max(1, totalPages));
}

function buildPageUrl(currentUrl, page) {
  const url = new URL(currentUrl);
  if (page <= 1) {
    url.searchParams.delete("page");
  } else {
    url.searchParams.set("page", page);
  }
  return url.toString();
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { buildPageUrl, clampPage };
}

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", function () {
    const contentDiv = document.getElementById("wallpapers-container");
    const paginationDiv = document.getElementById("pagination");
    const prevPageButton = document.getElementById("prevPage");
    const nextPageButton = document.getElementById("nextPage");
    const pageNumbersDiv = document.getElementById("pageNumbers");
    const statusMessage = document.getElementById("status-message");
    const itemsPerPage = 36;
    const imageSuffix = "_UHD.jpg&w=960&h=540";
    const visiblePageLinks = 3;
    let currentPage = 1;
    let allData = [];

    function getPageFromURL() {
      const params = new URLSearchParams(window.location.search);
      return params.get("page");
    }

    function setStatus(message, isError = false) {
      statusMessage.textContent = message;
      statusMessage.classList.toggle("error", isError);
      statusMessage.hidden = !message;
    }

    function updateURL(page, mode) {
      const url = buildPageUrl(window.location.href, page);
      if (mode === "replace") {
        window.history.replaceState({}, "", url);
      } else if (mode === "push") {
        window.history.pushState({}, "", url);
      }
    }

    function displayWallpapers() {
      const fragment = document.createDocumentFragment();
      const startIndex = (currentPage - 1) * itemsPerPage;
      const currentData = allData.slice(startIndex, startIndex + itemsPerPage);

      currentData.forEach((item) => {
        const link = document.createElement("a");
        link.className = "wallpaper-card";
        link.href = `fullscreen.html?date=${encodeURIComponent(item.image_date)}`;
        link.target = "_blank";
        link.rel = "noopener";

        const image = document.createElement("img");
        image.src = item.image_urlbase + imageSuffix;
        image.alt = "";
        image.loading = "lazy";
        image.decoding = "async";
        image.width = 960;
        image.height = 540;

        const description = document.createElement("span");
        description.textContent = item.copyright;

        link.append(image, description);
        fragment.appendChild(link);
      });

      contentDiv.replaceChildren(fragment);
    }

    function createPageButton(page) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = page;
      button.setAttribute("aria-label", `第 ${page} 页`);

      if (page === currentPage) {
        button.classList.add("active");
        button.setAttribute("aria-current", "page");
      }

      button.addEventListener("click", () => {
        navigateToPage(page);
      });
      return button;
    }

    function appendEllipsis() {
      const ellipsis = document.createElement("span");
      ellipsis.textContent = "...";
      ellipsis.setAttribute("aria-hidden", "true");
      pageNumbersDiv.appendChild(ellipsis);
    }

    function updatePaginationButtons() {
      const totalPages = Math.ceil(allData.length / itemsPerPage);
      prevPageButton.disabled = currentPage <= 1;
      nextPageButton.disabled = currentPage >= totalPages;
      pageNumbersDiv.replaceChildren();

      let startPage = Math.max(
        1,
        currentPage - Math.floor(visiblePageLinks / 2),
      );
      let endPage = Math.min(
        totalPages,
        currentPage + Math.floor(visiblePageLinks / 2),
      );

      if (endPage - startPage + 1 < visiblePageLinks) {
        if (startPage === 1) {
          endPage = Math.min(totalPages, visiblePageLinks);
        } else {
          startPage = Math.max(1, totalPages - visiblePageLinks + 1);
        }
      }

      if (startPage > 1) {
        pageNumbersDiv.appendChild(createPageButton(1));
        if (startPage > 2) {
          appendEllipsis();
        }
      }

      for (let page = startPage; page <= endPage; page += 1) {
        pageNumbersDiv.appendChild(createPageButton(page));
      }

      if (endPage < totalPages) {
        if (totalPages - endPage > 1) {
          appendEllipsis();
        }
        pageNumbersDiv.appendChild(createPageButton(totalPages));
      }
    }

    function navigateToPage(
      page,
      { historyMode = "push", scroll = true } = {},
    ) {
      if (!allData.length) {
        return;
      }

      const totalPages = Math.ceil(allData.length / itemsPerPage);
      currentPage = clampPage(page, totalPages);
      displayWallpapers();
      updatePaginationButtons();
      updateURL(currentPage, historyMode);

      if (scroll) {
        window.scrollTo({ top: 0, behavior: "auto" });
      }
    }

    fetch("data/data.json")
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        if (!Array.isArray(data)) {
          throw new Error("Wallpaper data must be an array");
        }

        allData = data;
        if (!allData.length) {
          setStatus("暂无壁纸数据");
          return;
        }

        setStatus("");
        paginationDiv.hidden = false;
        navigateToPage(getPageFromURL(), {
          historyMode: "replace",
          scroll: false,
        });
      })
      .catch((error) => {
        console.error("Error fetching data:", error);
        setStatus("壁纸数据加载失败，请稍后重试", true);
      });

    prevPageButton.addEventListener("click", () => {
      navigateToPage(currentPage - 1);
    });

    nextPageButton.addEventListener("click", () => {
      navigateToPage(currentPage + 1);
    });

    window.addEventListener("popstate", () => {
      navigateToPage(getPageFromURL(), {
        historyMode: null,
        scroll: false,
      });
    });
  });
}
