@echo off
title 启动跨域放行浏览器 (CORS-Free Chrome)
echo ====================================================
echo      MATP 专用 - 启动跨域放行联调浏览器 (CORS-Free)
echo ====================================================
echo.
echo 正在尝试定位您的 Google Chrome 浏览器安装路径...
echo.

set CHROME_PATH1="C:\Program Files\Google\Chrome\Application\chrome.exe"
set CHROME_PATH2="C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"

if exist %CHROME_PATH1% (
    echo [✓] 发现 Chrome 位于 Program Files。
    echo 正在以跨域豁免模式启动联调浏览器...
    start "" %CHROME_PATH1% --user-data-dir="C:\ChromeDev" --disable-web-security "http://127.0.0.1:9090/index.html"
    exit
)

if exist %CHROME_PATH2% (
    echo [✓] 发现 Chrome 位于 Program Files (x86)。
    echo 正在以跨域豁免模式启动联调浏览器...
    start "" %CHROME_PATH2% --user-data-dir="C:\ChromeDev" --disable-web-security "http://127.0.0.1:9090/index.html"
    exit
)

echo.
echo [✕] 错误：未能在系统的默认路径中自动找到 Chrome 浏览器。
echo 请确保您的电脑上已安装了 Google Chrome。
echo 如果安装在其他路径，您可以右键编辑此 .bat 文件，并修改实际的 chrome.exe 路径。
echo.
pause
