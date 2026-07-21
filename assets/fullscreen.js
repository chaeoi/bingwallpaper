function normalizeCarouselIndex(index, length) {
  if (!Number.isInteger(length) || length <= 0) {
    return -1;
  }
  return ((index % length) + length) % length;
}

function buildDateUrl(currentUrl, imageDate) {
  const url = new URL(currentUrl);
  url.searchParams.set("date", imageDate);
  return url.toString();
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { buildDateUrl, normalizeCarouselIndex };
}

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", function () {
    const viewerImage = document.getElementById("viewer-image");
    const copyrightInfo = document.getElementById("copyright-info");
    const prevButton = document.getElementById("prev-image");
    const nextButton = document.getElementById("next-image");
    const imageViewerContainer = document.getElementById(
      "image-viewer-container",
    );
    const statusMessage = document.getElementById("viewer-status");
    const highResSuffix = "_UHD.jpg";
    const swipeThreshold = 50;
    const preloadedUrls = new Set();
    let allData = [];
    let currentIndex = -1;
    let touchStartX = null;

    function getDateFromURL() {
      return new URLSearchParams(window.location.search).get("date");
    }

    function setStatus(message, isError = false) {
      statusMessage.textContent = message;
      statusMessage.classList.toggle("error", isError);
      statusMessage.hidden = !message;
    }

    function updateURL(index, mode) {
      const url = buildDateUrl(window.location.href, allData[index].image_date);
      if (mode === "replace") {
        window.history.replaceState({}, "", url);
      } else if (mode === "push") {
        window.history.pushState({}, "", url);
      }
    }

    function shouldPreload() {
      const connection = navigator.connection;
      if (
        connection &&
        (connection.saveData || /(^|-)2g$/.test(connection.effectiveType))
      ) {
        return false;
      }
      return !window.matchMedia("(max-width: 768px)").matches;
    }

    function preloadAdjacentImages(index) {
      if (allData.length <= 1 || !shouldPreload()) {
        return;
      }

      const adjacentIndexes = [
        normalizeCarouselIndex(index - 1, allData.length),
        normalizeCarouselIndex(index + 1, allData.length),
      ];

      adjacentIndexes.forEach((adjacentIndex) => {
        const imageUrl = allData[adjacentIndex].image_urlbase + highResSuffix;
        if (preloadedUrls.has(imageUrl)) {
          return;
        }

        preloadedUrls.add(imageUrl);
        const preloadImage = new Image();
        preloadImage.src = imageUrl;
      });
    }

    function scheduleAdjacentPreload(index) {
      const preload = () => preloadAdjacentImages(index);
      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(preload, { timeout: 1500 });
      } else {
        window.setTimeout(preload, 250);
      }
    }

    function displayImage(index, historyMode = null) {
      if (!allData.length) {
        return;
      }

      currentIndex = normalizeCarouselIndex(index, allData.length);
      const item = allData[currentIndex];
      setStatus("正在加载图片");
      viewerImage.src = item.image_urlbase + highResSuffix;
      viewerImage.alt = item.copyright;
      copyrightInfo.textContent = item.copyright;
      document.title = `${item.image_date} - Bing Wallpaper`;
      updateURL(currentIndex, historyMode);
    }

    function displayDateFromHistory() {
      const imageDate = getDateFromURL();
      const index = allData.findIndex((item) => item.image_date === imageDate);
      if (index >= 0) {
        displayImage(index);
      }
    }

    function navigate(offset) {
      if (allData.length) {
        displayImage(currentIndex + offset, "push");
      }
    }

    viewerImage.addEventListener("load", () => {
      setStatus("");
      scheduleAdjacentPreload(currentIndex);
    });

    viewerImage.addEventListener("error", () => {
      setStatus("图片加载失败，请稍后重试", true);
    });

    fetch("data/data.json")
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        if (!Array.isArray(data) || !data.length) {
          throw new Error("Wallpaper data must be a non-empty array");
        }

        allData = data;
        const requestedDate = getDateFromURL();
        const requestedIndex = allData.findIndex(
          (item) => item.image_date === requestedDate,
        );
        const initialIndex = requestedIndex >= 0 ? requestedIndex : 0;
        const historyMode = requestedIndex >= 0 ? null : "replace";
        prevButton.disabled = allData.length <= 1;
        nextButton.disabled = allData.length <= 1;
        displayImage(initialIndex, historyMode);
      })
      .catch((error) => {
        console.error("Error fetching data:", error);
        setStatus("壁纸数据加载失败，请稍后重试", true);
      });

    prevButton.addEventListener("click", () => {
      navigate(1);
    });

    nextButton.addEventListener("click", () => {
      navigate(-1);
    });

    imageViewerContainer.addEventListener(
      "touchstart",
      (event) => {
        touchStartX = event.touches[0].clientX;
      },
      { passive: true },
    );

    imageViewerContainer.addEventListener(
      "touchend",
      (event) => {
        if (touchStartX === null) {
          return;
        }

        const deltaX = event.changedTouches[0].clientX - touchStartX;
        if (Math.abs(deltaX) > swipeThreshold) {
          navigate(deltaX > 0 ? -1 : 1);
        }
        touchStartX = null;
      },
      { passive: true },
    );

    document.addEventListener("keydown", (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        navigate(1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        navigate(-1);
      }
    });

    window.addEventListener("popstate", displayDateFromHistory);
  });
}
