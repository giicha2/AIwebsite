const contents = {
  home: {
    welcomeLink: true,
    title: "안녕하세요, 1인개발TV입니다!",
    paragraphs: [
      "혼자서 기획하고, 만들고, 배우는 1인 개발 채널이에요.",
      "웹사이트, 자동화, 작은 서비스까지 — 아이디어를 직접 구현해 나가고 있습니다.",
      "궁금한 점이 있으시면 편하게 둘러보세요. 함께 성장하는 개발 이야기를 나눠요!",
    ],
  },
  projects: {
    dynamic: "projects",
  },
  gallery: {
    dynamic: "gallery",
  },
  blog: {
    badge: "개발일지",
    title: "오늘의 개발 기록",
    paragraphs: [
      "배운 것, 막혔던 것, 해결한 방법을 짧게 기록합니다.",
    ],
    dynamic: "blog",
  },
  about: {
    badge: "소개",
    title: "1인개발TV는",
    paragraphs: [
      "개발을 좋아하는 1인 크리에이터가 운영하는 채널입니다.",
      "만들기를 즐기고, 기록하고, 공유하는 것을 목표로 합니다.",
    ],
    youtube: {
      title: "YouTube 활동",
      paragraphs: [
        "1인개발TV는 @giicha2 계정으로 운영하는 유튜브 채널입니다.",
        "프로그래밍, 게임개발, 그래픽툴 등 개발 관련과 인생에 도움 되는 지식을 영상으로 공유합니다.",
        "뱀파이어 서바이벌류 모바일 게임 만들기 시리즈 등 1인 개발 과정을 꾸준히 업로드하고 있습니다.",
      ],
      links: [
        { label: "YouTube 채널", url: "https://www.youtube.com/@giicha2" },
        { label: "최신 영상 보기", url: "https://www.youtube.com/watch?v=JpWUUp7szUE" },
        { label: "시리즈 1편", url: "https://www.youtube.com/watch?v=wGFscVrfw78" },
      ],
    },
  },
};

let mediaCache = null;
let projectsCache = null;

const cacheBust = () => `?v=${Date.now()}`;

function mediaSrc(path, modified) {
  if (!path) return "";
  const version =
    typeof modified === "number" && modified > 0 ? `?v=${modified}` : "";
  return `${encodeURI(path)}${version}`;
}

function safeAttr(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;");
}

function galleryThumbApiSrc(item) {
  const params = new URLSearchParams({
    path: item.src,
    w: "480",
    v: String(item.modified || 0),
  });

  return `api/thumb.php?${params.toString()}`;
}

function galleryImageThumbSrc(item) {
  if (item.thumb) {
    return mediaSrc(item.thumb, item.modified);
  }

  const parts = item.src.split("/");
  const folder = parts[0];
  const filename = parts[parts.length - 1] || "";
  const stem = filename.replace(/\.[^.]+$/, "");

  if (stem && (folder === "shots" || folder === "images")) {
    return mediaSrc(`${folder}/thumbs/${stem}.jpg`, item.modified);
  }

  return galleryThumbApiSrc(item);
}

const DEFAULT_VIDEO_POSTER = "images/video-thumb-default.jpg";

function galleryVideoPosterSrc(item) {
  if (item.poster) {
    return mediaSrc(item.poster, item.modified);
  }

  return DEFAULT_VIDEO_POSTER;
}

function galleryVideoSourceSrc(item) {
  const base = mediaSrc(item.src, item.modified);
  return base.includes("#") ? base : `${base}#t=0.05`;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(timestamp) {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function videoMimeType(src) {
  const ext = src.split(".").pop().toLowerCase();

  if (ext === "webm") return "video/webm";
  if (ext === "mov") return "video/quicktime";
  return "video/mp4";
}

function parseHashRoute() {
  const hash = location.hash.replace(/^#/, "");

  if (hash.startsWith("project/")) {
    return {
      tab: "projects",
      projectId: decodeURIComponent(hash.slice("project/".length)),
    };
  }

  return { tab: hash || "home", projectId: null };
}

const navTabs = ["home", "projects", "gallery", "blog"];

function setActiveTab(tab) {
  document.querySelectorAll(".tab").forEach((item) => {
    item.classList.toggle(
      "active",
      navTabs.includes(tab) && item.dataset.tab === tab
    );
  });
}

function navigateToProject(projectId) {
  location.hash = `project/${encodeURIComponent(projectId)}`;
}

function navigateToProjects() {
  location.hash = "projects";
}

async function fetchProjects() {
  if (projectsCache) {
    return projectsCache;
  }

  const sources = [`api/projects.php${cacheBust()}`, `projects.json${cacheBust()}`];

  for (const source of sources) {
    try {
      const response = await fetch(source);
      if (!response.ok) continue;

      const projects = await response.json();
      if (Array.isArray(projects)) {
        projectsCache = projects;
        return projects;
      }
    } catch (_error) {
      continue;
    }
  }

  projectsCache = [];
  return projectsCache;
}

async function fetchProject(projectId) {
  const sources = [
    `api/projects.php?id=${encodeURIComponent(projectId)}&v=${Date.now()}`,
    `projects.json${cacheBust()}`,
  ];

  try {
    const response = await fetch(sources[0]);
    if (response.ok) {
      const project = await response.json();
      if (project && project.id) {
        return project;
      }
    }
  } catch (_error) {
    // fallback below
  }

  const projects = await fetchProjects();
  return projects.find((project) => project.id === projectId) || null;
}

const PROJECT_ORDER = ["soul-stone", "vampire-survival"];

function sortProjects(projects) {
  return [...projects].sort((a, b) => {
    const aRank = PROJECT_ORDER.indexOf(a.id);
    const bRank = PROJECT_ORDER.indexOf(b.id);
    const aOrder = aRank === -1 ? PROJECT_ORDER.length + 1 : aRank;
    const bOrder = bRank === -1 ? PROJECT_ORDER.length + 1 : bRank;

    if (aOrder !== bOrder) {
      return aOrder - bOrder;
    }

    return (b.modified || 0) - (a.modified || 0);
  });
}

function resolveProjectMediaType(media, mediaType) {
  if (mediaType) {
    return mediaType;
  }

  if (media && [".mp4", ".webm", ".mov"].some((ext) => media.toLowerCase().endsWith(ext))) {
    return "video";
  }

  return "image";
}

function renderProjectMediaItem(media, mediaType, altText) {
  const type = resolveProjectMediaType(media, mediaType);

  if (!media) {
    return "";
  }

  if (type === "video") {
    return `
      <video autoplay muted loop playsinline preload="metadata">
        <source src="${mediaSrc(media)}" type="${videoMimeType(media)}" />
      </video>
    `;
  }

  return `<img src="${mediaSrc(media)}" alt="${escapeHtml(altText)}" loading="lazy" />`;
}

function renderProjectMedia(project) {
  return renderProjectMediaItem(
    project.media || project.image,
    project.mediaType,
    project.title
  );
}

function renderProjectSections(project) {
  const sections = Array.isArray(project.sections) ? project.sections : [];

  if (!sections.length) {
    return "";
  }

  const fallbackMedia = project.media || project.image || "";
  const fallbackType = project.mediaType || "video";

  const items = sections
    .map((section) => {
      const media = section.media || fallbackMedia;
      const mediaType = section.mediaType || fallbackType;
      const hasMedia = Boolean(media);

      const mediaTypeResolved = resolveProjectMediaType(media, mediaType);

      return `
        <article class="project-feature">
          <div
            class="project-feature-media${hasMedia ? " project-feature-media--interactive" : " project-feature-media--empty"}"
            ${hasMedia ? `data-media-type="${mediaTypeResolved}" data-media-src="${escapeHtml(media)}" data-media-title="${escapeHtml(section.title)}" tabindex="0" role="button" aria-label="${escapeHtml(section.title)} 미디어 재생"` : ""}
          >
            ${hasMedia ? renderProjectMediaItem(media, mediaType, section.title) : ""}
            <div class="project-feature-overlay"></div>
          </div>
          <div class="project-feature-content">
            <h3>${escapeHtml(section.title)}</h3>
            <p>${escapeHtml(section.text)}</p>
          </div>
        </article>
      `;
    })
    .join("");

  return `<div class="project-detail-sections">${items}</div>`;
}

function renderProjects(projects) {
  if (!projects.length) {
    return `
      <p class="media-empty">
        projects/ 폴더에 프로젝트를 추가해 주세요.<br />
        예) projects/my-app/info.json + cover.jpg 또는 cover.mp4
      </p>
    `;
  }

  const items = sortProjects(projects)
    .map((project) => {
      const hasMedia = Boolean(project.media || project.image);
      const featuredClass = project.id === "soul-stone" ? " project-tile--featured" : "";

      return `
        <article class="project-tile${featuredClass}${hasMedia ? "" : " project-hero--empty"}" data-project-id="${escapeHtml(project.id)}" tabindex="0" role="link" aria-label="${escapeHtml(project.title)} 상세 보기">
          <div class="project-tile-media">
            ${renderProjectMedia(project)}
          </div>
          <div class="project-tile-overlay"></div>
          <div class="project-tile-content">
            ${project.status ? `<span class="project-status">${escapeHtml(project.status)}</span>` : ""}
            <h3>${escapeHtml(project.title)}</h3>
            <p>${escapeHtml(project.description)}</p>
          </div>
        </article>
      `;
    })
    .join("");

  return `<div class="project-list">${items}</div>`;
}

function initProjectList() {
  document.querySelectorAll("[data-project-id]").forEach((card) => {
    const openProject = () => navigateToProject(card.dataset.projectId);

    card.addEventListener("click", openProject);
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openProject();
      }
    });
  });
}

function renderProjectLinks(project) {
  const links = Array.isArray(project.links) ? project.links : [];

  if (!links.length && project.link) {
    links.push({ label: "바로가기", url: project.link });
  }

  if (!links.length) {
    return "";
  }

  return links
    .map(
      (item) => `
        <a class="project-link" href="${escapeHtml(item.url)}" target="_blank" rel="noopener">
          ${escapeHtml(item.label)}
        </a>
      `
    )
    .join("");
}

function renderProjectDetail(project) {
  const hasMedia = Boolean(project.media || project.image);
  const linkHtml = renderProjectLinks(project);

  return `
    <button class="project-back" type="button" id="project-back">← 프로젝트 목록</button>
    <article class="project-detail-hero project-hero${hasMedia ? "" : " project-hero--empty"}">
      <div class="project-hero-media">
        ${renderProjectMedia(project)}
        <div class="project-hero-overlay"></div>
      </div>
      <div class="project-hero-content">
        ${project.status ? `<span class="project-status">${escapeHtml(project.status)}</span>` : ""}
        <h3>${escapeHtml(project.title)}</h3>
        <p>${escapeHtml(project.description)}</p>
      </div>
    </article>
    <div class="project-detail-body">
      <h2>프로젝트 소개</h2>
      <p class="project-detail-text">${escapeHtml(project.details || project.description)}</p>
      <div class="project-detail-meta">${linkHtml}</div>
    </div>
    ${renderProjectSections(project)}
  `;
}

async function renderProjectPage(data, projectId) {
  const content = document.getElementById("content");
  const project = await fetchProject(projectId);

  if (!project) {
    content.className = "hero hero--projects";
    content.innerHTML = `
      <span class="badge">${data.badge}</span>
      <h2>프로젝트를 찾을 수 없습니다</h2>
      <p class="media-empty">요청하신 프로젝트가 없거나 삭제되었습니다.</p>
      <button class="project-back" type="button" id="project-back">← 프로젝트 목록</button>
    `;
    document.getElementById("project-back")?.addEventListener("click", navigateToProjects);
    return;
  }

  content.className = "hero hero--project-detail";
  content.innerHTML = renderProjectDetail(project);
  document.getElementById("project-back")?.addEventListener("click", navigateToProjects);
  initProjectFeatureMedia();
}

async function fetchMedia() {
  const sources = [`api/media.php${cacheBust()}`, `media.json${cacheBust()}`];

  for (const source of sources) {
    try {
      const response = await fetch(source);

      if (!response.ok) continue;

      const data = await response.json();

      if (Array.isArray(data.photos) && Array.isArray(data.videos)) {
        mediaCache = data;
        return data;
      }
    } catch (_error) {
      continue;
    }
  }

  mediaCache = { photos: [], videos: [] };
  return mediaCache;
}

function sortBlogPosts(posts) {
  return [...posts].sort((a, b) => (b.created || 0) - (a.created || 0));
}

async function parseJsonResponse(response) {
  const text = await response.text();

  if (!text.trim()) {
    return null;
  }

  if (text.trim().startsWith("<")) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (_error) {
    return null;
  }
}

const BLOG_TOKEN_KEY = "1indevtv-blog-token";

function getBlogToken() {
  return sessionStorage.getItem(BLOG_TOKEN_KEY) || "";
}

function setBlogToken(token) {
  sessionStorage.setItem(BLOG_TOKEN_KEY, token);
}

function clearBlogToken() {
  sessionStorage.removeItem(BLOG_TOKEN_KEY);
}

function blogAuthHeaders() {
  const headers = { "Content-Type": "application/json" };
  const token = getBlogToken();

  if (token) {
    headers["X-Blog-Token"] = token;
  }

  return headers;
}

async function fetchBlogAuthStatus() {
  try {
    const response = await fetch(`api/blog-auth.php${cacheBust()}`, {
      headers: blogAuthHeaders(),
    });
    const data = await parseJsonResponse(response);

    if (!response.ok || !data) {
      return { configured: false, authenticated: false };
    }

    return {
      configured: Boolean(data.configured),
      authenticated: Boolean(data.authenticated),
    };
  } catch (_error) {
    return { configured: false, authenticated: false };
  }
}

async function loginBlog(password) {
  const response = await fetch(`api/blog-auth.php${cacheBust()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  const data = await parseJsonResponse(response);

  if (response.ok && data?.token) {
    setBlogToken(data.token);
    return true;
  }

  const message = data?.error || "로그인에 실패했습니다.";
  throw new Error(message);
}

async function logoutBlog() {
  try {
    await fetch(`api/blog-auth.php${cacheBust()}`, {
      method: "DELETE",
      headers: blogAuthHeaders(),
    });
  } catch (_error) {
    // ignore network errors on logout
  } finally {
    clearBlogToken();
  }
}

async function getBlogServerStatus() {
  const status = {
    apiReady: false,
    jsonReady: false,
  };

  try {
    const response = await fetch(`api/blog.php${cacheBust()}`, {
      method: "POST",
      headers: blogAuthHeaders(),
      body: JSON.stringify({}),
    });
    const data = await parseJsonResponse(response);
    status.apiReady =
      (response.status === 400 && Boolean(data?.error)) ||
      (response.status === 401 && Boolean(data?.error));
  } catch (_error) {
    status.apiReady = false;
  }

  if (!status.apiReady) {
    try {
      const response = await fetch(`api/blog.php${cacheBust()}`);
      const data = await parseJsonResponse(response);
      status.apiReady = response.ok && Array.isArray(data);
    } catch (_error) {
      status.apiReady = false;
    }
  }

  try {
    const response = await fetch(`blog/posts.json${cacheBust()}`);
    const data = await parseJsonResponse(response);
    status.jsonReady = response.ok && Array.isArray(data);
  } catch (_error) {
    status.jsonReady = false;
  }

  return status;
}

async function fetchBlogPosts() {
  const sources = [`api/blog.php${cacheBust()}`, `blog/posts.json${cacheBust()}`];

  for (const source of sources) {
    try {
      const response = await fetch(source);

      if (!response.ok) continue;

      const posts = await parseJsonResponse(response);

      if (Array.isArray(posts)) {
        return sortBlogPosts(posts);
      }
    } catch (_error) {
      continue;
    }
  }

  return [];
}

async function requestBlogApi(method, payload) {
  const response = await fetch(`api/blog.php${cacheBust()}`, {
    method,
    headers: blogAuthHeaders(),
    body: JSON.stringify(payload),
  });

  const data = await parseJsonResponse(response);

  if (response.ok && data?.ok) {
    return data;
  }

  if (response.status === 401) {
    clearBlogToken();
    throw new Error(data?.error || "로그인이 필요합니다. 다시 로그인해 주세요.");
  }

  const message =
    data?.error ||
    (response.ok ? "요청에 실패했습니다." : "서버에 연결할 수 없습니다.");
  throw new Error(message);
}

async function saveBlogPost(title, content) {
  const data = await requestBlogApi("POST", { title, content });
  return data.post;
}

async function updateBlogPost(id, title, content) {
  const data = await requestBlogApi("PUT", { id, title, content });
  return data.post;
}

async function deleteBlogPost(id) {
  await requestBlogApi("DELETE", { id });
}

function renderAlbum(photos) {
  if (!photos.length) {
    return `<p class="media-empty">shots/ 폴더에 사진을 넣어 주세요. (jpg, png, gif, webp)</p>`;
  }

  const items = photos
    .map(
      (photo) => `
        <a href="${mediaSrc(photo.src)}" class="insta-item" target="_blank" rel="noopener">
          <img src="${mediaSrc(photo.src)}" alt="${photo.name}" loading="lazy" />
        </a>
      `
    )
    .join("");

  return `
    <div class="insta-feed">
      <div class="insta-grid">${items}</div>
    </div>
  `;
}

function renderVideos(videoList) {
  if (!videoList.length) {
    return `<p class="media-empty">videos/ 폴더에 영상을 넣어 주세요. (mp4, webm, mov)</p>`;
  }

  const items = videoList
    .map(
      (video) => `
        <article class="video-card">
          <div class="video-wrapper">
            <video controls preload="metadata" playsinline>
              <source src="${mediaSrc(video.src)}" type="${videoMimeType(video.src)}" />
            </video>
          </div>
          <h3>${video.name}</h3>
        </article>
      `
    )
    .join("");

  return `<div class="video-grid">${items}</div>`;
}

function renderGalleryThumb(item) {
  const src = escapeHtml(item.src);
  const title = escapeHtml(item.name);
  const modified = item.modified || 0;

  if (item.type === "video") {
    const videoSrc = galleryVideoSourceSrc(item);
    const posterSrc = galleryVideoPosterSrc(item);

    return `
      <button
        type="button"
        class="gallery-thumb gallery-thumb--video"
        data-type="video"
        data-src="${src}"
        data-title="${title}"
        data-modified="${modified}"
        aria-label="${title} 영상 보기"
      >
        <span class="gallery-thumb-video-fallback" aria-hidden="true"></span>
        <video
          class="gallery-thumb-video-preview"
          preload="metadata"
          muted
          playsinline
          poster="${safeAttr(posterSrc)}"
          aria-hidden="true"
        >
          <source src="${safeAttr(videoSrc)}" type="${videoMimeType(item.src)}" />
        </video>
        <span class="gallery-thumb-play" aria-hidden="true">▶</span>
      </button>
    `;
  }

  const thumbSrc = galleryImageThumbSrc(item);
  const fallbackSrc = galleryThumbApiSrc(item);

  return `
    <button
      type="button"
      class="gallery-thumb"
      data-type="image"
      data-src="${src}"
      data-title="${title}"
      data-modified="${modified}"
      aria-label="${title} 이미지 보기"
    >
      <img
        src="${safeAttr(thumbSrc)}"
        data-fallback="${safeAttr(fallbackSrc)}"
        alt="${title}"
        loading="lazy"
        decoding="async"
        fetchpriority="low"
        onerror="if(this.dataset.fallback){this.onerror=null;this.src=this.dataset.fallback;}"
      />
    </button>
  `;
}

const GALLERY_PLACEHOLDER_COUNT = 5;

function renderGalleryThumbs(items) {
  return `
    <div class="gallery-thumb-grid">
      ${items.map((item) => renderGalleryThumb(item)).join("")}
    </div>
  `;
}

function renderEmptyGalleryThumb() {
  return `<div class="gallery-thumb gallery-thumb--empty" aria-hidden="true"></div>`;
}

function renderGalleryThumbsWithPlaceholders(items, minCount = GALLERY_PLACEHOLDER_COUNT) {
  const thumbs = items.map((item) => renderGalleryThumb(item));
  const emptyCount = Math.max(0, minCount - items.length);

  for (let i = 0; i < emptyCount; i += 1) {
    thumbs.push(renderEmptyGalleryThumb());
  }

  return `<div class="gallery-thumb-grid">${thumbs.join("")}</div>`;
}

function renderGallery(media) {
  const items = [
    ...media.videos.map((video) => ({ ...video, type: "video" })),
    ...media.photos.map((photo) => ({ ...photo, type: "image" })),
  ];

  if (items.length < GALLERY_PLACEHOLDER_COUNT) {
    return renderGalleryThumbsWithPlaceholders(items);
  }

  const videosHtml = media.videos.length
    ? `
      <section class="gallery-section">
        <h3 class="gallery-section-title">동영상</h3>
        ${renderGalleryThumbs(
          media.videos.map((video) => ({ ...video, type: "video" }))
        )}
      </section>
    `
    : "";

  const photosHtml = media.photos.length
    ? `
      <section class="gallery-section">
        <h3 class="gallery-section-title">스샷</h3>
        ${renderGalleryThumbs(
          media.photos.map((photo) => ({ ...photo, type: "image" }))
        )}
      </section>
    `
    : "";

  return `${videosHtml}${photosHtml}`;
}

let lightboxControlsReady = false;
let lightboxOpen = false;
let lightboxSource = "gallery";
let blockClicksUntil = 0;

function openLightbox(type, src, title, source = "gallery", modified) {
  const lightbox = document.getElementById("lightbox");
  const content = document.getElementById("lightbox-content");
  const caption = document.getElementById("lightbox-caption");

  if (!lightbox || !content || !caption) return;

  lightboxSource = source;

  if (source === "gallery" && location.hash !== "#gallery") {
    location.hash = "gallery";
  }

  const version = typeof modified === "number" && modified > 0 ? modified : undefined;
  const mediaUrl = mediaSrc(src, version);

  if (type === "video") {
    content.innerHTML = `
      <video controls autoplay playsinline>
        <source src="${mediaUrl}" type="${videoMimeType(src)}" />
      </video>
    `;
  } else {
    content.innerHTML = `<img src="${mediaUrl}" alt="${escapeHtml(title)}" />`;
  }

  caption.textContent = title;
  lightbox.classList.add("is-open");
  lightbox.setAttribute("aria-hidden", "false");
  lightboxOpen = true;
  document.body.classList.add("lightbox-open");
  document.body.style.overflow = "hidden";

  if (source === "gallery") {
    history.pushState({ lightbox: true, source }, "", "#gallery");
  } else {
    history.pushState({ lightbox: true, source }, "");
  }
}

function closeLightbox(fromPopstate = false) {
  const lightbox = document.getElementById("lightbox");
  const content = document.getElementById("lightbox-content");
  const closingSource = lightboxSource;

  if (!lightbox?.classList.contains("is-open")) return;

  const video = content.querySelector("video");
  if (video) {
    video.pause();
  }

  content.innerHTML = "";
  lightbox.classList.remove("is-open");
  lightbox.setAttribute("aria-hidden", "true");
  lightboxOpen = false;
  lightboxSource = "gallery";
  document.body.classList.remove("lightbox-open");
  document.body.style.overflow = "";
  blockClicksUntil = Date.now() + 350;

  if (closingSource === "gallery") {
    setActiveTab("gallery");
  }

  if (closingSource === "project") {
    resumeProjectFeaturePreviews();
  }

  if (!fromPopstate && history.state?.lightbox) {
    history.back();
  }
}

function pauseProjectFeaturePreviews() {
  document.querySelectorAll(".project-feature-media video").forEach((video) => {
    video.pause();
  });
}

function resumeProjectFeaturePreviews() {
  document.querySelectorAll(".project-feature-media video").forEach((video) => {
    video.muted = true;
    video.play().catch(() => {});
  });
}

function activateProjectFeatureMedia(mediaEl) {
  const type = mediaEl.dataset.mediaType;
  const src = mediaEl.dataset.mediaSrc;
  const title = mediaEl.dataset.mediaTitle || "";

  if (!src) return;

  pauseProjectFeaturePreviews();
  openLightbox(type === "video" ? "video" : "image", src, title, "project");
}

function initProjectFeatureMedia() {
  document.querySelectorAll(".project-feature-media[data-media-src]").forEach((mediaEl) => {
    const handleActivate = () => activateProjectFeatureMedia(mediaEl);

    mediaEl.addEventListener("click", handleActivate);
    mediaEl.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleActivate();
      }
    });
  });
}

function primeGalleryVideoPreview(video) {
  const showFallback = () => {
    video.style.display = "none";
  };

  const seekPreview = async () => {
    if (!Number.isFinite(video.duration) || video.duration <= 0) {
      return;
    }

    const targetTime = Math.min(0.5, Math.max(0.05, video.duration * 0.05));

    try {
      video.currentTime = targetTime;
      await video.play();
      video.pause();
      video.currentTime = targetTime;
    } catch (_error) {
      video.currentTime = targetTime;
    }
  };

  video.addEventListener("error", showFallback, { once: true });
  video.addEventListener("loadedmetadata", () => {
    seekPreview();
  }, { once: true });
}

function initGalleryVideoPosters() {
  document.querySelectorAll(".gallery-thumb--video .gallery-thumb-video-preview").forEach((video) => {
    primeGalleryVideoPreview(video);
  });
}

function initGalleryLightbox() {
  document.querySelectorAll(".gallery-thumb").forEach((thumb) => {
    thumb.addEventListener("click", (event) => {
      event.stopPropagation();
      const modified = Number(thumb.dataset.modified) || undefined;
      openLightbox(
        thumb.dataset.type,
        thumb.dataset.src,
        thumb.dataset.title,
        "gallery",
        modified
      );
    });
  });
}

function initLightboxControls() {
  const lightbox = document.getElementById("lightbox");
  const backdrop = document.getElementById("lightbox-backdrop");
  const closeBtn = document.getElementById("lightbox-close");
  const panel = document.querySelector(".lightbox-panel");

  if (lightboxControlsReady) return;
  lightboxControlsReady = true;

  backdrop?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeLightbox();
  });

  closeBtn?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeLightbox();
  });

  panel?.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && lightbox?.classList.contains("is-open")) {
      event.preventDefault();
      closeLightbox();
    }
  });

  window.addEventListener("popstate", () => {
    if (lightboxOpen) {
      closeLightbox(true);
    }
  });

  document.addEventListener(
    "click",
    (event) => {
      if (Date.now() < blockClicksUntil) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    true
  );
}

function resetContentElement(content) {
  content.onclick = null;
  content.onkeydown = null;
  content.removeAttribute("role");
  content.removeAttribute("tabindex");
  content.removeAttribute("aria-label");
}

function renderAboutContent(data) {
  const content = document.getElementById("content");
  const youtube = data.youtube;
  const youtubeLinks = youtube?.links
    ?.map(
      (item) => `
        <a class="project-link" href="${escapeHtml(item.url)}" target="_blank" rel="noopener">
          ${escapeHtml(item.label)}
        </a>
      `
    )
    .join("");

  content.className = "hero";
  content.removeAttribute("role");
  content.removeAttribute("tabindex");
  content.removeAttribute("aria-label");
  content.onclick = null;
  content.onkeydown = null;
  content.innerHTML = `
    <span class="badge">${data.badge}</span>
    <h2>${data.title}</h2>
    ${data.paragraphs.map((p) => `<p>${p}</p>`).join("")}
    <section class="about-youtube">
      <h3>${youtube.title}</h3>
      ${youtube.paragraphs.map((p) => `<p>${p}</p>`).join("")}
      <div class="about-links">${youtubeLinks || ""}</div>
    </section>
    <button class="project-back" type="button" id="about-back">← 메인으로</button>
  `;

  document.getElementById("about-back")?.addEventListener("click", () => {
    location.hash = "home";
  });
}

function renderHomeContent(data) {
  const content = document.getElementById("content");

  content.className = "hero hero--home-link";
  content.setAttribute("role", "link");
  content.setAttribute("tabindex", "0");
  content.setAttribute("aria-label", "소개 페이지로 이동");
  content.innerHTML = `
    <span class="badge">환영합니다</span>
    <h2>${data.title}</h2>
    ${data.paragraphs.map((p) => `<p>${p}</p>`).join("")}
    <span class="home-link-hint">클릭하면 소개 페이지로 이동합니다</span>
  `;

  content.onclick = () => {
    location.hash = "about";
  };

  content.onkeydown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      location.hash = "about";
    }
  };
}

function renderBlogList(posts, canManage = false) {
  if (!posts.length) {
    return `<p class="blog-empty">아직 작성한 일지가 없습니다. 글쓰기 버튼으로 첫 글을 남겨 보세요.</p>`;
  }

  const items = posts
    .map(
      (post, index) => `
        <article class="blog-post" data-post-id="${escapeHtml(post.id)}">
          <div class="blog-post-head">
            <span class="blog-post-index">${index + 1}</span>
            <div class="blog-post-meta">
              <h3>${escapeHtml(post.title)}</h3>
              <time datetime="${post.created}">${formatDate(post.created)}</time>
            </div>
            ${
              canManage
                ? `<div class="blog-post-actions">
                    <button type="button" class="blog-edit-btn" data-action="edit" data-id="${escapeHtml(post.id)}">편집</button>
                    <button type="button" class="blog-delete-btn" data-action="delete" data-id="${escapeHtml(post.id)}">삭제</button>
                  </div>`
                : ""
            }
          </div>
          <p class="blog-post-body">${escapeHtml(post.content)}</p>
        </article>
      `
    )
    .join("");

  return `<div class="blog-list">${items}</div>`;
}

function updateBlogListUI(posts, canManage = false) {
  const listWrap = document.getElementById("blog-list-wrap");
  const countEl = document.querySelector(".blog-count strong");

  if (listWrap) {
    listWrap.innerHTML = renderBlogList(posts, canManage);
  }

  if (countEl) {
    countEl.textContent = String(posts.length);
  }
}

function renderBlogStorageNotice(status) {
  if (status.apiReady) {
    return "";
  }

  const issues = [];

  if (!status.jsonReady) {
    issues.push("blog/posts.json 파일을 찾을 수 없습니다");
  }

  if (!status.apiReady) {
    issues.push("api/blog.php(PHP)가 동작하지 않습니다");
  }

  return `
    <p class="blog-storage-notice">
      서버 저장이 아직 연결되지 않았습니다. NAS Web Station 문서 루트를 <strong>Share_Web</strong> 폴더로 맞추고 PHP를 켜 주세요.
      <span class="blog-storage-detail">${issues.join(" · ")}</span>
    </p>
  `;
}

function renderBlogSection(posts, status = { apiReady: false, jsonReady: false, authenticated: false }) {
  const canManage = status.apiReady && status.authenticated;
  const writeButtonAttrs = status.apiReady
    ? ""
    : ' disabled title="서버 저장 API 연결 후 사용할 수 있습니다"';

  return `
    <div class="blog-section">
      ${renderBlogStorageNotice(status)}
      <div class="blog-toolbar">
        <p class="blog-count">등록된 글 <strong>${posts.length}</strong>개</p>
        <div class="blog-toolbar-actions">
          ${
            status.apiReady && !status.authenticated
              ? '<button type="button" class="blog-login-btn" id="blog-login-btn">관리자 로그인</button>'
              : ""
          }
          ${
            canManage
              ? `<button type="button" class="blog-write-btn" id="blog-write-btn">글쓰기</button>
                 <button type="button" class="blog-logout-btn" id="blog-logout-btn">로그아웃</button>`
              : status.apiReady
                ? ""
                : `<button type="button" class="blog-write-btn" id="blog-write-btn"${writeButtonAttrs}>글쓰기</button>`
          }
        </div>
      </div>
      <div class="blog-login-panel" id="blog-login-panel" hidden>
        <form class="blog-login-form" id="blog-login-form">
          <label for="blog-password">관리자 비밀번호</label>
          <input id="blog-password" name="password" type="password" autocomplete="current-password" placeholder="비밀번호 입력" required />
          <div class="blog-form-actions">
            <button class="blog-login-submit" type="submit">로그인</button>
            <button class="blog-login-cancel" type="button" id="blog-login-cancel">취소</button>
          </div>
          <p class="blog-status" id="blog-login-status" aria-live="polite"></p>
        </form>
      </div>
      <div class="blog-form-panel" id="blog-form-panel" hidden>
        <form class="blog-form" id="blog-form">
          <label for="blog-title">제목</label>
          <input id="blog-title" name="title" type="text" maxlength="100" placeholder="오늘 무엇을 했나요?" required />

          <label for="blog-content">내용</label>
          <textarea id="blog-content" name="content" maxlength="5000" placeholder="배운 점, 막힌 점, 해결 방법을 자유롭게 적어 보세요." required></textarea>

          <div class="blog-form-actions">
            <button class="blog-submit" type="submit">글 등록</button>
            <button class="blog-cancel-btn" type="button" id="blog-cancel-btn">취소</button>
          </div>
          <p class="blog-status" id="blog-status" aria-live="polite"></p>
        </form>
      </div>
      <div class="blog-list-wrap" id="blog-list-wrap">
        ${renderBlogList(posts, canManage)}
      </div>
    </div>
  `;
}

function initBlogSection(onSaved, posts, serverStatus) {
  const writeBtn = document.getElementById("blog-write-btn");
  const cancelBtn = document.getElementById("blog-cancel-btn");
  const loginBtn = document.getElementById("blog-login-btn");
  const logoutBtn = document.getElementById("blog-logout-btn");
  const loginPanel = document.getElementById("blog-login-panel");
  const loginForm = document.getElementById("blog-login-form");
  const loginCancelBtn = document.getElementById("blog-login-cancel");
  const loginStatus = document.getElementById("blog-login-status");
  const formPanel = document.getElementById("blog-form-panel");
  const form = document.getElementById("blog-form");
  const status = document.getElementById("blog-status");
  const submitButton = form.querySelector(".blog-submit");
  const listWrap = document.getElementById("blog-list-wrap");
  let editingPostId = null;
  let authenticated = Boolean(serverStatus.authenticated);

  const setFormMode = (mode) => {
    submitButton.textContent = mode === "edit" ? "수정 완료" : "글 등록";
  };

  const openForm = (post = null) => {
    editingPostId = post?.id ?? null;
    form.title.value = post?.title ?? "";
    form.content.value = post?.content ?? "";
    setFormMode(post ? "edit" : "create");
    formPanel.hidden = false;
    writeBtn.hidden = true;
    status.textContent = "";
    status.className = "blog-status";
    form.title.focus();
  };

  const closeForm = () => {
    editingPostId = null;
    formPanel.hidden = true;
    writeBtn.hidden = false;
    form.reset();
    setFormMode("create");
    status.textContent = "";
    status.className = "blog-status";
  };

  const openLoginPanel = () => {
    if (!loginPanel) return;
    loginPanel.hidden = false;
    loginStatus.textContent = "";
    loginStatus.className = "blog-status";
    loginForm.password.focus();
  };

  const closeLoginPanel = () => {
    if (!loginPanel) return;
    loginPanel.hidden = true;
    loginForm.reset();
    loginStatus.textContent = "";
    loginStatus.className = "blog-status";
  };

  if (loginBtn) {
    loginBtn.addEventListener("click", openLoginPanel);
  }

  if (loginCancelBtn) {
    loginCancelBtn.addEventListener("click", closeLoginPanel);
  }

  if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const password = loginForm.password.value;
      const submitBtn = loginForm.querySelector(".blog-login-submit");

      submitBtn.disabled = true;
      loginStatus.textContent = "로그인 중...";
      loginStatus.className = "blog-status";

      try {
        await loginBlog(password);
        authenticated = true;
        closeLoginPanel();
        await renderBlogContent(contents.blog);
      } catch (error) {
        loginStatus.className = "blog-status error";
        loginStatus.textContent = error.message || "로그인에 실패했습니다.";
      } finally {
        submitBtn.disabled = false;
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await logoutBlog();
      authenticated = false;
      closeForm();
      await renderBlogContent(contents.blog);
    });
  }

  writeBtn?.addEventListener("click", () => {
    if (!authenticated) {
      openLoginPanel();
      return;
    }

    openForm();
  });
  cancelBtn.addEventListener("click", closeForm);

  listWrap.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;

    const postId = button.dataset.id;
    const post = posts.find((item) => item.id === postId);
    if (!post) return;

    if (button.dataset.action === "edit") {
      openForm(post);
      formPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
      return;
    }

    if (button.dataset.action === "delete") {
      if (!window.confirm(`「${post.title}」 글을 삭제할까요?`)) {
        return;
      }

      button.disabled = true;

      try {
        await deleteBlogPost(postId);
        const latestPosts = await onSaved();
        posts.length = 0;
        posts.push(...latestPosts);
      } catch (error) {
        window.alert(
          error.message === "Failed to fetch"
            ? "서버에 연결할 수 없습니다. api/blog.php 설정을 확인해 주세요."
            : error.message || "글 삭제에 실패했습니다."
        );
        button.disabled = false;
      }
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const title = form.title.value.trim();
    const content = form.content.value.trim();

    if (!title || !content) {
      status.textContent = "제목과 내용을 모두 입력해 주세요.";
      status.className = "blog-status error";
      return;
    }

    submitButton.disabled = true;
    status.textContent = editingPostId ? "서버에 수정 중..." : "서버에 저장 중...";
    status.className = "blog-status";

    try {
      if (editingPostId) {
        await updateBlogPost(editingPostId, title, content);
        status.className = "blog-status success";
        status.textContent = "글이 수정되었습니다.";
      } else {
        await saveBlogPost(title, content);
        status.className = "blog-status success";
        status.textContent = "서버에 글이 등록되었습니다.";
      }

      const latestPosts = await onSaved();
      posts.length = 0;
      posts.push(...latestPosts);
      closeForm();
    } catch (error) {
      status.className = "blog-status error";
      status.textContent =
        error.message === "Failed to fetch"
          ? "서버에 연결할 수 없습니다. api/blog.php 설정을 확인해 주세요."
          : error.message || "서버 저장에 실패했습니다.";
    } finally {
      submitButton.disabled = false;
    }
  });
}

async function renderBlogContent(data) {
  const content = document.getElementById("content");
  const [posts, serverStatus, authStatus] = await Promise.all([
    fetchBlogPosts(),
    getBlogServerStatus(),
    fetchBlogAuthStatus(),
  ]);

  const blogStatus = {
    ...serverStatus,
    authenticated: authStatus.authenticated,
  };

  content.className = "hero";
  content.innerHTML = `
    <span class="badge">${data.badge}</span>
    <h2>${data.title}</h2>
    ${data.paragraphs.map((p) => `<p>${p}</p>`).join("")}
    ${renderBlogSection(posts, blogStatus)}
  `;

  initBlogSection(async () => {
    const latestPosts = await fetchBlogPosts();
    updateBlogListUI(latestPosts, blogStatus.apiReady && blogStatus.authenticated);
    return latestPosts;
  }, posts, blogStatus);
}

async function renderDynamicContent(tab, data) {
  const content = document.getElementById("content");

  if (data.dynamic === "blog") {
    await renderBlogContent(data);
    return;
  }

  if (data.dynamic === "projects") {
    const route = parseHashRoute();

    if (route.projectId) {
      await renderProjectPage(data, route.projectId);
      return;
    }

    const projects = await fetchProjects();
    content.className = "hero hero--projects";
    content.innerHTML = renderProjects(projects);
    initProjectList();
    return;
  }

  if (data.dynamic === "gallery") {
    const media = mediaCache || (await fetchMedia());
    content.className = "hero hero--gallery";
    content.innerHTML = renderGallery(media);
    initLightboxControls();
    initGalleryLightbox();
    initGalleryVideoPosters();
    return;
  }

  const media = mediaCache || (await fetchMedia());
  const dynamicHtml =
    data.dynamic === "photos"
      ? renderAlbum(media.photos)
      : renderVideos(media.videos);

  content.className = data.layout === "album" ? "hero hero--album" : "hero";
  content.innerHTML = `
    <span class="badge">${data.badge}</span>
    <h2>${data.title}</h2>
    ${data.paragraphs.map((p) => `<p>${p}</p>`).join("")}
    ${dynamicHtml}
  `;
}

function renderContent(tab) {
  const data = contents[tab];
  const content = document.getElementById("content");

  resetContentElement(content);

  if (!data) {
    renderContent("home");
    return;
  }

  if (tab === "home" && data.welcomeLink) {
    renderHomeContent(data);
    return;
  }

  if (tab === "about") {
    renderAboutContent(data);
    return;
  }

  if (data.dynamic) {
    const isAlbum = data.layout === "album";
    const isProjects = data.dynamic === "projects";
    const isGallery = data.dynamic === "gallery";

    content.className = isAlbum
      ? "hero hero--album"
      : isProjects
        ? "hero hero--projects"
        : isGallery
          ? "hero hero--gallery"
          : "hero";

    content.innerHTML =
      isProjects || isGallery
        ? `<p class="media-loading">불러오는 중...</p>`
        : `
          <span class="badge">${data.badge}</span>
          <h2>${data.title}</h2>
          ${(data.paragraphs || []).map((p) => `<p>${p}</p>`).join("")}
          <p class="media-loading">불러오는 중...</p>
        `;
    renderDynamicContent(tab, data);
    return;
  }

}

function toggleHomeWidgets(tab) {
  const widgets = document.getElementById("home-widgets");
  if (!widgets) return;

  widgets.classList.toggle("is-visible", tab === "home");
}

function handleRouteChange() {
  const route = parseHashRoute();
  const tab = contents[route.tab] ? route.tab : "home";
  const content = document.getElementById("content");
  const stayOnGallery =
    tab === "gallery" && content?.classList.contains("hero--gallery");

  setActiveTab(tab);
  toggleHomeWidgets(tab);

  if (stayOnGallery) {
    return;
  }

  if (tab !== "projects") {
    projectsCache = null;
  }

  renderContent(tab);
}

function initTabs() {
  const tabs = document.querySelectorAll(".tab");

  tabs.forEach((tab) => {
    tab.addEventListener("click", (e) => {
      e.preventDefault();
      location.hash = tab.dataset.tab;
    });
  });

  window.addEventListener("hashchange", handleRouteChange);
}

const VISIT_SESSION_KEY = "1indevtv-visited-session";
const VISIT_LOCAL_KEY = "1indevtv-visit-count";
const THEME_KEY = "1indevtv-theme";

function padTime(value) {
  return String(value).padStart(2, "0");
}

function updateClock() {
  const now = new Date();
  const clock = document.getElementById("live-clock");
  const date = document.getElementById("live-date");

  if (!clock || !date) return;

  clock.textContent = now.toLocaleTimeString("ko-KR", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  date.textContent = now.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
}

function applyTheme(theme) {
  const isDark = theme === "dark";
  document.documentElement.dataset.theme = isDark ? "dark" : "light";

  const toggleBtn = document.getElementById("theme-toggle-btn");
  if (toggleBtn) {
    toggleBtn.textContent = isDark ? "라이트 모드" : "다크 모드";
    toggleBtn.setAttribute("aria-pressed", String(isDark));
    toggleBtn.setAttribute(
      "aria-label",
      isDark ? "사이트 라이트 모드로 전환" : "사이트 다크 모드로 전환"
    );
  }
}

function initThemeToggle() {
  const savedTheme = localStorage.getItem(THEME_KEY);
  const theme = savedTheme === "dark" || savedTheme === "light" ? savedTheme : "light";
  applyTheme(theme);

  document.getElementById("theme-toggle-btn")?.addEventListener("click", () => {
    const nextTheme =
      document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    localStorage.setItem(THEME_KEY, nextTheme);
    applyTheme(nextTheme);
  });
}

function renderCalendar() {
  const container = document.getElementById("calendar-widget");
  if (!container) return;

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const lastDate = new Date(year, month + 1, 0).getDate();
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];

  const weekdayHtml = weekdays
    .map((day) => `<div class="calendar-weekday">${day}</div>`)
    .join("");

  const emptyDays = Array.from({ length: firstDay }, () => {
    return `<div class="calendar-day empty">0</div>`;
  });

  const monthDays = Array.from({ length: lastDate }, (_, index) => {
    const day = index + 1;
    const className = day === today ? "calendar-day today" : "calendar-day";
    return `<div class="${className}">${day}</div>`;
  });

  container.innerHTML = `
    <div class="calendar-header">
      <span>${year}년 ${month + 1}월</span>
      <span>오늘 ${today}일</span>
    </div>
    <div class="calendar-grid">
      ${weekdayHtml}
      ${emptyDays.join("")}
      ${monthDays.join("")}
    </div>
  `;
}

function updateVisitorDisplay(data) {
  const totalEl = document.getElementById("visitor-count");
  const todayEl = document.getElementById("visitor-today");

  if (!totalEl || !todayEl) return;

  totalEl.textContent = Number(data.total || 0).toLocaleString("ko-KR");
  todayEl.textContent = `오늘 ${Number(data.todayCount || 0).toLocaleString("ko-KR")}명`;
}

function loadLocalVisitCount() {
  try {
    const raw = localStorage.getItem(VISIT_LOCAL_KEY);
    const data = raw ? JSON.parse(raw) : { total: 0, todayCount: 0, today: "" };
    const today = new Date().toISOString().slice(0, 10);

    if (data.today !== today) {
      return { total: data.total || 0, todayCount: 0, today };
    }

    return {
      total: data.total || 0,
      todayCount: data.todayCount || 0,
      today,
    };
  } catch (_error) {
    return { total: 0, todayCount: 0, today: "" };
  }
}

function saveLocalVisitCount(data) {
  localStorage.setItem(VISIT_LOCAL_KEY, JSON.stringify(data));
}

async function fetchVisitCount() {
  const sources = [`api/visits.php${cacheBust()}`, `data/visits.json${cacheBust()}`];

  for (const source of sources) {
    try {
      const response = await fetch(source);
      if (!response.ok) continue;

      const data = await response.json();
      if (typeof data.total === "number") {
        updateVisitorDisplay(data);
        return data;
      }
    } catch (_error) {
      continue;
    }
  }

  const localData = loadLocalVisitCount();
  updateVisitorDisplay(localData);
  return localData;
}

async function incrementVisitCount() {
  try {
    const response = await fetch(`api/visits.php${cacheBust()}`, {
      method: "POST",
    });

    if (response.ok) {
      const data = await response.json();
      updateVisitorDisplay(data);
      return data;
    }
  } catch (_error) {
    // fallback below
  }

  const localData = loadLocalVisitCount();
  const today = new Date().toISOString().slice(0, 10);

  if (localData.today !== today) {
    localData.today = today;
    localData.todayCount = 0;
  }

  localData.total += 1;
  localData.todayCount += 1;
  saveLocalVisitCount(localData);
  updateVisitorDisplay(localData);
  return localData;
}

async function initVisitorCounter() {
  if (!sessionStorage.getItem(VISIT_SESSION_KEY)) {
    sessionStorage.setItem(VISIT_SESSION_KEY, "1");
    await incrementVisitCount();
    return;
  }

  await fetchVisitCount();
}

function initWidgets() {
  initThemeToggle();
  updateClock();
  renderCalendar();
  setInterval(updateClock, 1000);
  initVisitorCounter();
  fetchMedia().catch(() => {});
}

if (!location.hash) {
  location.hash = "home";
} else {
  handleRouteChange();
}

initTabs();
initWidgets();
initLightboxControls();
