// 豆瓣热门电影电视剧推荐功能

// 豆瓣标签列表 - 修改为默认标签
let defaultMovieTags = ['热门', '最新', '经典', '豆瓣高分', '冷门佳片', '华语', '欧美', '韩国', '日本', '动作', '喜剧', '爱情', '科幻', '悬疑', '恐怖', '治愈'];
let defaultTvTags = ['热门', '美剧', '英剧', '韩剧', '日剧', '国产剧', '港剧', '日本动画', '综艺', '纪录片'];

// 用户标签列表 - 存储用户实际使用的标签（包含保留的系统标签和用户添加的自定义标签）
let movieTags = [];
let tvTags = [];

// 加载用户标签
function loadUserTags() {
    try {
        // 尝试从本地存储加载用户保存的标签
        const savedMovieTags = localStorage.getItem('userMovieTags');
        const savedTvTags = localStorage.getItem('userTvTags');

        // 如果本地存储中有标签数据，则使用它
        if (savedMovieTags) {
            movieTags = JSON.parse(savedMovieTags);
        } else {
            // 否则使用默认标签
            movieTags = [...defaultMovieTags];
        }

        if (savedTvTags) {
            tvTags = JSON.parse(savedTvTags);
        } else {
            // 否则使用默认标签
            tvTags = [...defaultTvTags];
        }
    } catch (e) {
        console.error('加载标签失败：', e);
        // 初始化为默认值，防止错误
        movieTags = [...defaultMovieTags];
        tvTags = [...defaultTvTags];
    }
}

// 保存用户标签
function saveUserTags() {
    try {
        localStorage.setItem('userMovieTags', JSON.stringify(movieTags));
        localStorage.setItem('userTvTags', JSON.stringify(tvTags));
    } catch (e) {
        console.error('保存标签失败：', e);
        showToast('保存标签失败', 'error');
    }
}

let doubanMovieTvCurrentSwitch = 'movie';
let doubanCurrentTag = '热门';
let doubanPageStart = 0;
const doubanPageSize = 30; // 一次显示的项目数量

// 初始化豆瓣功能
// 存储滚动加载清理函数的引用
let scrollLoadCleanup = null;

function initDouban() {
    // 清理过期的豆瓣缓存
    clearExpiredDoubanCache();

    // 设置豆瓣开关的初始状态
    const doubanToggle = document.getElementById('doubanToggle');
    if (doubanToggle) {
        // 获取豆瓣开关状态，默认为开启
        const isEnabled = localStorage.getItem('doubanEnabled') !== 'false';
        // 如果是首次访问，设置默认值
        if (localStorage.getItem('doubanEnabled') === null) {
            localStorage.setItem('doubanEnabled', 'true');
        }
        doubanToggle.checked = isEnabled;

        // 设置开关外观
        const toggleBg = doubanToggle.nextElementSibling;
        const toggleDot = toggleBg.nextElementSibling;
        if (isEnabled) {
            toggleBg.classList.add('bg-pink-600');
            toggleDot.classList.add('translate-x-6');
        }

        // 添加事件监听
        doubanToggle.addEventListener('change', function (e) {
            const isChecked = e.target.checked;
            localStorage.setItem('doubanEnabled', isChecked);

            // 更新开关外观
            if (isChecked) {
                toggleBg.classList.add('bg-pink-600');
                toggleDot.classList.add('translate-x-6');
            } else {
                toggleBg.classList.remove('bg-pink-600');
                toggleDot.classList.remove('translate-x-6');
            }

            // 更新显示状态
            updateDoubanVisibility();
        });

        // 初始更新显示状态
        updateDoubanVisibility();

        // 滚动到页面顶部
        window.scrollTo(0, 0);
    }

    // 加载用户标签
    loadUserTags();

    // 渲染电影/电视剧切换
    renderDoubanMovieTvSwitch();

    // 渲染豆瓣标签
    renderDoubanTags();

    // 如果有之前的滚动加载，先清理
    if (scrollLoadCleanup) {
        scrollLoadCleanup();
    }

    // 设置新的滚动加载并保存清理函数
    scrollLoadCleanup = setupScrollLoad();

    // 初始加载热门内容
    if (localStorage.getItem('doubanEnabled') === 'true') {
        renderRecommend(doubanCurrentTag, doubanPageSize, doubanPageStart);
    }
}

// 根据设置更新豆瓣区域的显示状态
function updateDoubanVisibility() {
    const doubanArea = document.getElementById('doubanArea');
    if (!doubanArea) return;

    const isEnabled = localStorage.getItem('doubanEnabled') === 'true';
    const isSearching = document.getElementById('resultsArea') &&
        !document.getElementById('resultsArea').classList.contains('hidden');

    // 只有在启用且没有搜索结果显示时才显示豆瓣区域
    if (isEnabled && !isSearching) {
        doubanArea.classList.remove('hidden');
        // 如果豆瓣结果为空，重新加载
        if (document.getElementById('douban-results').children.length === 0) {
            renderRecommend(doubanCurrentTag, doubanPageSize, doubanPageStart);
        }
    } else {
        doubanArea.classList.add('hidden');
    }
}

// 只填充搜索框，不执行搜索，让用户自主决定搜索时机
function fillSearchInput(title) {
    if (!title) return;

    // 安全处理标题，防止XSS
    const safeTitle = title
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const input = document.getElementById('searchInput');
    if (input) {
        input.value = safeTitle;

        // 聚焦搜索框，便于用户立即使用键盘操作
        input.focus();

        // 显示一个提示，告知用户点击搜索按钮进行搜索
        showToast('已填充搜索内容，点击搜索按钮开始搜索', 'info');
    }
}

// 填充搜索框并执行搜索
function fillAndSearch(title) {
    if (!title) return;

    // 安全处理标题，防止XSS
    const safeTitle = title
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const input = document.getElementById('searchInput');
    if (input) {
        input.value = safeTitle;
        search(); // 使用已有的search函数执行搜索
    }
}

// 填充搜索框，确保豆瓣资源API被选中，然后执行搜索
function fillAndSearchWithDouban(title) {
    if (!title) return;

    // 安全处理标题，防止XSS
    const safeTitle = title
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    // 确保豆瓣资源API被选中
    if (typeof selectedAPIs !== 'undefined' && !selectedAPIs.includes('dbzy')) {
        // 在设置中勾选豆瓣资源API复选框
        const doubanCheckbox = document.querySelector('input[id="api_dbzy"]');
        if (doubanCheckbox) {
            doubanCheckbox.checked = true;

            // 触发updateSelectedAPIs函数以更新状态
            if (typeof updateSelectedAPIs === 'function') {
                updateSelectedAPIs();
            } else {
                // 如果函数不可用，则手动添加到selectedAPIs
                selectedAPIs.push('dbzy');
                localStorage.setItem('selectedAPIs', JSON.stringify(selectedAPIs));

                // 更新选中API计数（如果有这个元素）
                const countEl = document.getElementById('selectedAPICount');
                if (countEl) {
                    countEl.textContent = selectedAPIs.length;
                }
            }

            showToast('已自动选择豆瓣资源API', 'info');
        }
    }

    // 填充搜索框并执行搜索
    const input = document.getElementById('searchInput');
    if (input) {
        input.value = safeTitle;
        search(); // 使用已有的search函数执行搜索
    }
}

// 渲染电影/电视剧切换器
function renderDoubanMovieTvSwitch() {
    // 获取切换按钮元素
    const movieToggle = document.getElementById('douban-movie-toggle');
    const tvToggle = document.getElementById('douban-tv-toggle');

    if (!movieToggle || !tvToggle) return;

    movieToggle.addEventListener('click', function () {
        if (doubanMovieTvCurrentSwitch !== 'movie') {
            // 更新按钮样式
            movieToggle.classList.add('bg-pink-600', 'text-white');
            movieToggle.classList.remove('text-gray-300');

            tvToggle.classList.remove('bg-pink-600', 'text-white');
            tvToggle.classList.add('text-gray-300');

            doubanMovieTvCurrentSwitch = 'movie';
            doubanCurrentTag = '热门';
            doubanPageStart = 0;  // 重置页码

            // 重新加载豆瓣内容
            renderDoubanTags(movieTags);

            // 初始加载热门内容
            if (localStorage.getItem('doubanEnabled') === 'true') {
                renderRecommend(doubanCurrentTag, doubanPageSize, doubanPageStart);
            }
        }
    });

    // 电视剧按钮点击事件
    tvToggle.addEventListener('click', function () {
        if (doubanMovieTvCurrentSwitch !== 'tv') {
            // 更新按钮样式
            tvToggle.classList.add('bg-pink-600', 'text-white');
            tvToggle.classList.remove('text-gray-300');

            movieToggle.classList.remove('bg-pink-600', 'text-white');
            movieToggle.classList.add('text-gray-300');

            doubanMovieTvCurrentSwitch = 'tv';
            doubanCurrentTag = '热门';
            doubanPageStart = 0;  // 重置页码

            // 重新加载豆瓣内容
            renderDoubanTags(tvTags);

            // 初始加载热门内容
            if (localStorage.getItem('doubanEnabled') === 'true') {
                renderRecommend(doubanCurrentTag, doubanPageSize, doubanPageStart);
            }
        }
    });
}

// 渲染豆瓣标签选择器
function renderDoubanTags(tags) {
    const tagContainer = document.getElementById('douban-tags');
    if (!tagContainer) return;

    // 确定当前应该使用的标签列表
    const currentTags = doubanMovieTvCurrentSwitch === 'movie' ? movieTags : tvTags;

    // 清空标签容器
    tagContainer.innerHTML = '';

    // 先添加标签管理按钮
    const manageBtn = document.createElement('button');
    manageBtn.className = 'py-1.5 px-3.5 rounded text-sm font-medium transition-all duration-300 bg-[#1a1a1a] text-gray-300 hover:bg-pink-700 hover:text-white border border-[#333] hover:border-white';
    manageBtn.innerHTML = '<span class="flex items-center"><svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>管理标签</span>';
    manageBtn.onclick = function () {
        showTagManageModal();
    };
    tagContainer.appendChild(manageBtn);

    // 添加所有标签
    currentTags.forEach(tag => {
        const btn = document.createElement('button');

        // 设置样式
        let btnClass = 'py-1.5 px-3.5 rounded text-sm font-medium transition-all duration-300 ';
        // 当前选中的标签使用高亮样式
        if (tag === doubanCurrentTag) {
            btnClass += 'bg-pink-600 text-white shadow-md border-white';
        } else {
            btnClass += 'bg-[#1a1a1a] text-gray-300 hover:bg-pink-700 hover:text-white border-[#333] hover:border-white';
        }

        btn.className = btnClass;
        btn.textContent = tag;

        btn.onclick = function () {
            if (doubanCurrentTag !== tag) {
                doubanCurrentTag = tag;
                doubanPageStart = 0;
                renderRecommend(doubanCurrentTag, doubanPageSize, doubanPageStart);
                renderDoubanTags();
            }
        };

        tagContainer.appendChild(btn);
    });
}

// 添加滚动加载功能
function setupScrollLoad() {
    const doubanResults = document.getElementById('douban-results');
    const loadingIndicator = document.getElementById('douban-loading');
    let isLoading = false;
    let scrollTimeout = null;

    // 使用防抖优化滚动事件处理
    function debounce(func, wait) {
        return function () {
            if (scrollTimeout) clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                func.apply(this, arguments);
                scrollTimeout = null;
            }, wait);
        }
    }

    // 检查是否需要加载更多
    const checkAndLoad = debounce(function () {
        if (isLoading || !doubanResults || doubanResults.classList.contains('hidden')) return;

        const rect = doubanResults.getBoundingClientRect();
        const bottomOffset = rect.bottom - window.innerHeight;

        // 当距离底部150px时加载更多
        if (bottomOffset < 150) {
            loadMoreContent();
        }
    }, 100); // 100ms 防抖

    // 使用 Intersection Observer 优化滚动检测
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                checkAndLoad();
            }
        });
    }, {
        rootMargin: '150px'
    });

    // 观察加载指示器
    if (loadingIndicator) {
        observer.observe(loadingIndicator);
    }

    // 同时保留滚动事件监听作为后备方案
    window.addEventListener('scroll', checkAndLoad, { passive: true });

    async function loadMoreContent() {
        if (isLoading) return;

        isLoading = true;
        loadingIndicator.classList.remove('hidden');

        doubanPageStart += doubanPageSize;

        const target = `https://movie.douban.com/j/search_subjects?type=${doubanMovieTvCurrentSwitch}&tag=${doubanCurrentTag}&sort=recommend&page_limit=${doubanPageSize}&page_start=${doubanPageStart}`;

        try {
            // 检查是否有预加载的数据
            let data;
            const cachedData = preloadCache.get(target);

            if (cachedData) {
                if (cachedData instanceof Promise) {
                    // 等待预加载完成
                    await cachedData;
                    data = preloadCache.get(target).data;
                } else {
                    data = cachedData.data;
                }
                preloadCache.delete(target);
            } else {
                // 如果没有预加载数据，直接请求
                data = await fetchDoubanData(target);
            }

            if (data.subjects && data.subjects.length > 0) {
                // 追加新内容
                renderAdditionalDoubanCards(data);

                // 预加载下一页
                preloadNextPage(doubanCurrentTag, doubanPageSize, doubanPageStart + doubanPageSize);
            }
        } catch (error) {
            console.error("加载更多数据失败：", error);
            showToast('加载更多数据失败，请稍后重试', 'error');
        } finally {
            isLoading = false;
            loadingIndicator.classList.add('hidden');
        }
    }

    // 清理函数
    return function cleanup() {
        if (loadingIndicator) {
            observer.unobserve(loadingIndicator);
        }
        observer.disconnect();
        window.removeEventListener('scroll', checkAndLoad);
    };
}

async function fetchDoubanTags() {
    const urls = [
        'https://movie.douban.com/j/search_tags?type=movie',
        'https://movie.douban.com/j/search_tags?type=tv'
    ];

    try {
        // 并行请求电影和电视剧标签
        const [movieData, tvData] = await fetchDoubanData(urls);

        if (movieData && movieData.tags) {
            movieTags = movieData.tags;
            if (doubanMovieTvCurrentSwitch === 'movie') {
                renderDoubanTags(movieTags);
            }
        }

        if (tvData && tvData.tags) {
            tvTags = tvData.tags;
            if (doubanMovieTvCurrentSwitch === 'tv') {
                renderDoubanTags(tvTags);
            }
        }
    } catch (error) {
        console.error("获取豆瓣标签失败：", error);
        showToast('获取豆瓣标签失败，将使用默认标签', 'error');
    }
}

// 渲染热门推荐内容
// 预加载缓存
const preloadCache = new Map();

// 预加载下一页数据
function preloadNextPage(tag, pageLimit, pageStart) {
    const target = `https://movie.douban.com/j/search_subjects?type=${doubanMovieTvCurrentSwitch}&tag=${tag}&sort=recommend&page_limit=${pageLimit}&page_start=${pageStart}`;

    // 如果已经在预加载队列中，跳过
    if (preloadCache.has(target)) return;

    // 将预加载请求添加到缓存中
    const promise = fetchDoubanData(target)
        .then(data => {
            preloadCache.set(target, {
                data,
                timestamp: Date.now()
            });
        })
        .catch(error => {
            console.error("预加载数据失败：", error);
            preloadCache.delete(target);
        });

    preloadCache.set(target, promise);
}

async function renderRecommend(tag, pageLimit, pageStart) {
    const container = document.getElementById("douban-results");
    if (!container) return;

    const loadingOverlay = document.createElement("div");
    loadingOverlay.classList.add(
        "absolute",
        "inset-0",
        "bg-gray-100",
        "bg-opacity-20",
        "flex",
        "items-center",
        "justify-center",
        "z-10"
    );

    const loadingContent = document.createElement("div");
    loadingContent.innerHTML = `
      <div class="flex items-center justify-center">
          <div class="w-6 h-6 border-2 border-pink-500 border-t-transparent rounded-full animate-spin inline-block"></div>
          <span class="text-pink-500 ml-4">加载中...</span>
      </div>
    `;
    loadingOverlay.appendChild(loadingContent);

    // 冻结原有内容，并添加加载状态
    container.classList.add("relative");
    container.appendChild(loadingOverlay);

    const currentTarget = `https://movie.douban.com/j/search_subjects?type=${doubanMovieTvCurrentSwitch}&tag=${tag}&sort=recommend&page_limit=${pageLimit}&page_start=${pageStart}`;
    const nextTarget = `https://movie.douban.com/j/search_subjects?type=${doubanMovieTvCurrentSwitch}&tag=${tag}&sort=recommend&page_limit=${pageLimit}&page_start=${pageStart + pageLimit}`;

    try {
        // 检查是否有预加载的数据
        let currentPageData;
        const cachedData = preloadCache.get(currentTarget);

        if (cachedData) {
            if (cachedData instanceof Promise) {
                // 等待预加载完成
                await cachedData;
                currentPageData = preloadCache.get(currentTarget).data;
            } else {
                currentPageData = cachedData.data;
            }
            preloadCache.delete(currentTarget);
        } else {
            // 如果没有预加载数据，直接请求
            currentPageData = await fetchDoubanData(currentTarget);
        }

        // 渲染当前页数据
        renderDoubanCards(currentPageData, container);

        // 预加载下一页数据
        preloadNextPage(tag, pageLimit, pageStart + pageLimit);

    } catch (error) {
        console.error("获取豆瓣数据失败：", error);
        container.innerHTML = `
            <div class="col-span-full text-center py-8">
                <div class="text-red-400">❌ 获取豆瓣数据失败，请稍后重试</div>
                <div class="text-gray-500 text-sm mt-2">提示：使用VPN可能有助于解决此问题</div>
            </div>
        `;
    }
}

async function fetchDoubanData(urls) {
    // 如果传入单个URL，转换为数组
    const urlArray = Array.isArray(urls) ? urls : [urls];

    // 创建所有URL的请求Promise数组
    const requests = urlArray.map(async url => {
        const cacheKey = `douban_cache_${url}`;
        const cachedData = localStorage.getItem(cacheKey);

        if (cachedData) {
            const { data, timestamp } = JSON.parse(cachedData);
            const cacheAge = Date.now() - timestamp;
            const cacheExpiry = 60 * 60 * 1000; // 60分钟

            if (cacheAge < cacheExpiry) {
                console.log('使用缓存的豆瓣数据:', url);
                return data;
            }
            localStorage.removeItem(cacheKey);
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const fetchOptions = {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                'Referer': 'https://movie.douban.com/',
                'Accept': 'application/json, text/plain, */*',
            }
        };

        try {
            // 尝试直接访问
            const response = await fetch(PROXY_URL + encodeURIComponent(url), fetchOptions);
            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            const data = await response.json();

            // 存储到缓存
            localStorage.setItem(cacheKey, JSON.stringify({
                data,
                timestamp: Date.now()
            }));

            return data;
        } catch (err) {
            console.error("豆瓣 API 请求失败（直接代理）：", err);

            // 失败后尝试备用方法
            const fallbackUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;

            const fallbackResponse = await fetch(fallbackUrl);
            if (!fallbackResponse.ok) {
                throw new Error(`备用API请求失败! 状态: ${fallbackResponse.status}`);
            }

            const responseData = await fallbackResponse.json();
            if (!responseData || !responseData.contents) {
                throw new Error("无法获取有效数据");
            }

            const data = JSON.parse(responseData.contents);
            localStorage.setItem(cacheKey, JSON.stringify({
                data,
                timestamp: Date.now()
            }));

            return data;
        }
    });

    // 并行执行所有请求
    try {
        const results = await Promise.all(requests);
        return urlArray.length === 1 ? results[0] : results;
    } catch (error) {
        console.error("部分或全部豆瓣数据请求失败：", error);
        throw error;
    }
}

// 渲染豆瓣卡片（支持初始渲染和追加渲染）
function renderDoubanCards(data, container, append = false) {
    // 创建文档片段以提高性能
    const fragment = document.createDocumentFragment();

    // 如果没有数据且不是追加模式
    if (!data.subjects || data.subjects.length === 0) {
        if (!append) {
            const emptyEl = document.createElement("div");
            emptyEl.className = "col-span-full text-center py-8";
            emptyEl.innerHTML = `
                <div class="text-pink-500">❌ 暂无数据，请尝试其他分类</div>
            `;
            fragment.appendChild(emptyEl);
        }
    } else {
        // 循环创建每个影视卡片
        data.subjects.forEach(item => {
            const card = document.createElement("div");
            card.className = "bg-[#111] hover:bg-[#222] transition-all duration-300 rounded-lg overflow-hidden flex flex-col transform hover:scale-105 shadow-md hover:shadow-lg";

            // 生成卡片内容，确保安全显示（防止XSS）
            const safeTitle = item.title
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');

            const safeRate = (item.rate || "暂无")
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');

            // 处理图片URL
            // 1. 直接使用豆瓣图片URL (添加no-referrer属性)
            const originalCoverUrl = item.cover;

            // 2. 也准备代理URL作为备选
            const proxiedCoverUrl = PROXY_URL + encodeURIComponent(originalCoverUrl);

            // 为不同设备优化卡片布局
            card.innerHTML = `
                <div class="relative w-full aspect-[2/3] overflow-hidden cursor-pointer" onclick="fillAndSearchWithDouban('${safeTitle}')">
                    <img src="${originalCoverUrl}" alt="${safeTitle}" 
                        class="w-full h-full object-cover transition-transform duration-500 hover:scale-110"
                        onerror="this.onerror=null; this.src='${proxiedCoverUrl}'; this.classList.add('object-contain');"
                        loading="lazy" referrerpolicy="no-referrer">
                    <div class="absolute inset-0 bg-gradient-to-t from-black to-transparent opacity-60"></div>
                    <div class="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded-sm">
                        <span class="text-yellow-400">★</span> ${safeRate}
                    </div>
                    <div class="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-sm hover:bg-[#333] transition-colors">
                        <a href="${item.url}" target="_blank" rel="noopener noreferrer" title="在豆瓣查看">
                            🔗
                        </a>
                    </div>
                </div>
                <div class="p-2 text-center bg-[#111]">
                    <button onclick="fillAndSearchWithDouban('${safeTitle}')" 
                            class="text-sm font-medium text-white truncate w-full hover:text-pink-400 transition"
                            title="${safeTitle}">
                        ${safeTitle}
                    </button>
                </div>
            `;

            fragment.appendChild(card);
        });
    }

    // 根据模式处理容器内容
    if (!append) {
        container.innerHTML = "";
    }
    container.appendChild(fragment);
}

// 清理过期的豆瓣缓存
function clearExpiredDoubanCache() {
    const cacheExpiry = 60 * 60 * 1000; // 60分钟，以毫秒为单位

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('douban_cache_')) {
            try {
                const cached = JSON.parse(localStorage.getItem(key));
                const cacheAge = Date.now() - cached.timestamp;
                if (cacheAge >= cacheExpiry) {
                    localStorage.removeItem(key);
                    console.log(`清理过期缓存: ${key}`);
                }
            } catch (err) {
                // 如果缓存数据损坏，直接删除
                localStorage.removeItem(key);
                console.error(`清理损坏的缓存: ${key}`, err);
            }
        }
    }
}

// 追加渲染新的豆瓣卡片
function renderAdditionalDoubanCards(data) {
    const container = document.getElementById("douban-results");
    if (!container) return;

    renderDoubanCards(data, container, true);
}

// 重置到首页
function resetToHome() {
    // 清理滚动加载相关资源
    if (scrollLoadCleanup) {
        scrollLoadCleanup();
        scrollLoadCleanup = null;
    }

    // 清理预加载缓存
    preloadCache.clear();

    // 重置状态
    doubanMovieTvCurrentSwitch = 'movie';
    doubanCurrentTag = '热门';
    doubanPageStart = 0;

    // 重置界面
    resetSearchArea();
    updateDoubanVisibility();

    // 重新设置滚动加载
    scrollLoadCleanup = setupScrollLoad();

    // 修复：回首页时刷新最近搜索
    if (typeof renderSearchHistory === 'function') {
        renderSearchHistory();
    }

    // 重新渲染豆瓣电影/电视剧切换按钮，确保按钮状态和事件同步
    renderDoubanMovieTvSwitch();
    // 重新渲染豆瓣标签，确保事件和高亮状态恢复
    renderDoubanTags();
}

// 加载豆瓣首页内容
document.addEventListener('DOMContentLoaded', initDouban);

// 显示标签管理模态框
function showTagManageModal() {
    // 确保模态框在页面上只有一个实例
    let modal = document.getElementById('tagManageModal');
    if (modal) {
        document.body.removeChild(modal);
    }

    // 创建模态框元素
    modal = document.createElement('div');
    modal.id = 'tagManageModal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-40';

    // 当前使用的标签类型和默认标签
    const isMovie = doubanMovieTvCurrentSwitch === 'movie';
    const currentTags = isMovie ? movieTags : tvTags;
    const defaultTags = isMovie ? defaultMovieTags : defaultTvTags;

    // 模态框内容
    modal.innerHTML = `
        <div class="bg-[#191919] rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto relative">
            <button id="closeTagModal" class="absolute top-4 right-4 text-gray-400 hover:text-white text-xl">&times;</button>
            
            <h3 class="text-xl font-bold text-white mb-4">标签管理 (${isMovie ? '电影' : '电视剧'})</h3>
            
            <div class="mb-4">
                <div class="flex justify-between items-center mb-2">
                    <h4 class="text-lg font-medium text-gray-300">标签列表</h4>
                    <button id="resetTagsBtn" class="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded">
                        恢复默认标签
                    </button>
                </div>
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4" id="tagsGrid">
                    ${currentTags.length ? currentTags.map(tag => {
        // "热门"标签不能删除
        const canDelete = tag !== '热门';
        return `
                            <div class="bg-[#1a1a1a] text-gray-300 py-1.5 px-3 rounded text-sm font-medium flex justify-between items-center group">
                                <span>${tag}</span>
                                ${canDelete ?
                `<button class="delete-tag-btn text-gray-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" 
                                        data-tag="${tag}">✕</button>` :
                `<span class="text-gray-500 text-xs italic opacity-0 group-hover:opacity-100">必需</span>`
            }
                            </div>
                        `;
    }).join('') :
            `<div class="col-span-full text-center py-4 text-gray-500">无标签，请添加或恢复默认</div>`}
                </div>
            </div>
            
            <div class="border-t border-gray-700 pt-4">
                <h4 class="text-lg font-medium text-gray-300 mb-3">添加新标签</h4>
                <form id="addTagForm" class="flex items-center">
                    <input type="text" id="newTagInput" placeholder="输入标签名称..." 
                           class="flex-1 bg-[#222] text-white border border-gray-700 rounded px-3 py-2 focus:outline-none focus:border-pink-500">
                    <button type="submit" class="ml-2 bg-pink-600 hover:bg-pink-700 text-white px-4 py-2 rounded">添加</button>
                </form>
                <p class="text-xs text-gray-500 mt-2">提示：标签名称不能为空，不能重复，不能包含特殊字符</p>
            </div>
        </div>
    `;

    // 添加模态框到页面
    document.body.appendChild(modal);

    // 焦点放在输入框上
    setTimeout(() => {
        document.getElementById('newTagInput').focus();
    }, 100);

    // 添加事件监听器 - 关闭按钮
    document.getElementById('closeTagModal').addEventListener('click', function () {
        document.body.removeChild(modal);
    });

    // 添加事件监听器 - 点击模态框外部关闭
    modal.addEventListener('click', function (e) {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });

    // 添加事件监听器 - 恢复默认标签按钮
    document.getElementById('resetTagsBtn').addEventListener('click', function () {
        resetTagsToDefault();
        showTagManageModal(); // 重新加载模态框
    });

    // 添加事件监听器 - 删除标签按钮
    const deleteButtons = document.querySelectorAll('.delete-tag-btn');
    deleteButtons.forEach(btn => {
        btn.addEventListener('click', function () {
            const tagToDelete = this.getAttribute('data-tag');
            deleteTag(tagToDelete);
            showTagManageModal(); // 重新加载模态框
        });
    });

    // 添加事件监听器 - 表单提交
    document.getElementById('addTagForm').addEventListener('submit', function (e) {
        e.preventDefault();
        const input = document.getElementById('newTagInput');
        const newTag = input.value.trim();

        if (newTag) {
            addTag(newTag);
            input.value = '';
            showTagManageModal(); // 重新加载模态框
        }
    });
}

// 添加标签
function addTag(tag) {
    // 安全处理标签名，防止XSS
    const safeTag = tag
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    // 确定当前使用的是电影还是电视剧标签
    const isMovie = doubanMovieTvCurrentSwitch === 'movie';
    const currentTags = isMovie ? movieTags : tvTags;

    // 检查是否已存在（忽略大小写）
    const exists = currentTags.some(
        existingTag => existingTag.toLowerCase() === safeTag.toLowerCase()
    );

    if (exists) {
        showToast('标签已存在', 'warning');
        return;
    }

    // 添加到对应的标签数组
    if (isMovie) {
        movieTags.push(safeTag);
    } else {
        tvTags.push(safeTag);
    }

    // 保存到本地存储
    saveUserTags();

    // 重新渲染标签
    renderDoubanTags();

    showToast('标签添加成功', 'success');
}

// 删除标签
function deleteTag(tag) {
    // 热门标签不能删除
    if (tag === '热门') {
        showToast('热门标签不能删除', 'warning');
        return;
    }

    // 确定当前使用的是电影还是电视剧标签
    const isMovie = doubanMovieTvCurrentSwitch === 'movie';
    const currentTags = isMovie ? movieTags : tvTags;

    // 寻找标签索引
    const index = currentTags.indexOf(tag);

    // 如果找到标签，则删除
    if (index !== -1) {
        currentTags.splice(index, 1);

        // 保存到本地存储
        saveUserTags();

        // 如果当前选中的是被删除的标签，则重置为"热门"
        if (doubanCurrentTag === tag) {
            doubanCurrentTag = '热门';
            doubanPageStart = 0;
            renderRecommend(doubanCurrentTag, doubanPageSize, doubanPageStart);
        }

        // 重新渲染标签
        renderDoubanTags();

        showToast('标签删除成功', 'success');
    }
}

// 重置为默认标签
function resetTagsToDefault() {
    // 确定当前使用的是电影还是电视剧
    const isMovie = doubanMovieTvCurrentSwitch === 'movie';

    // 重置为默认标签
    if (isMovie) {
        movieTags = [...defaultMovieTags];
    } else {
        tvTags = [...defaultTvTags];
    }

    // 设置当前标签为热门
    doubanCurrentTag = '热门';
    doubanPageStart = 0;

    // 保存到本地存储
    saveUserTags();

    // 重新渲染标签和内容
    renderDoubanTags();
    renderRecommend(doubanCurrentTag, doubanPageSize, doubanPageStart);

    showToast('已恢复默认标签', 'success');
}
