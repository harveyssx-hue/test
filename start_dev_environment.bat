@echo off
title MATP 联调服务器与浏览器一键启动
echo ====================================================
echo      MATP 专用 - 启动本地服务器与跨域放行浏览器
echo ====================================================
echo.

rem 如果已存在旧的 PID 文件，先尝试强制终止旧的服务器进程以防端口冲突
if exist "%~dp0server.pid" (
    echo [*] 检测到上次未完全关闭的服务，正在释放端口占用...
    set /p ORPHAN_PID=<"%~dp0server.pid"
    taskkill /F /PID %ORPHAN_PID% >nul 2>&1
    del "%~dp0server.pid" >nul 2>&1
)

echo [1/3] 正在启动后台极稳健 HTTP 本地服务器 (监听端口 9090)...
start /b powershell -WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -File "%~dp0start_server.ps1"

rem 稍作等待以确保 HTTP Listener 成功启动并生成 PID 文件
timeout /t 2 >nul

echo [2/3] 正在检测您的 Google Chrome 浏览器安装路径并启动前端系统...
echo.

set CHROME_PATH1="C:\Program Files\Google\Chrome\Application\chrome.exe"
set CHROME_PATH2="C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
set TARGET_URL="http://127.0.0.1:9090/index.html"

if exist %CHROME_PATH1% (
    echo [✓] 成功检测到 Chrome 位于 Program Files。
    echo 正在以跨域/Cookie 豁免模式启动联调浏览器并加载本地服务...
    start "" %CHROME_PATH1% --user-data-dir="C:\ChromeDev" --disable-web-security --disable-features=SameSiteByDefaultCookies,CookiesWithoutSameSiteMustBeSecure %TARGET_URL%
    goto RUNNING
)

if exist %CHROME_PATH2% (
    echo [✓] 成功检测到 Chrome 位于 Program Files (x86)。
    echo 正在以跨域/Cookie 豁免模式启动联调浏览器并加载本地服务...
    start "" %CHROME_PATH2% --user-data-dir="C:\ChromeDev" --disable-web-security --disable-features=SameSiteByDefaultCookies,CookiesWithoutSameSiteMustBeSecure %TARGET_URL%
    goto RUNNING
)

echo [!] 提示：未在系统默认路径找到 Google Chrome。
echo 正在尝试用系统默认浏览器直接打开 %TARGET_URL% (注意：若非 Chrome，可能会面临 Cookie 跨域限制)
start "" %TARGET_URL%

:RUNNING
echo.
echo ====================================================
echo [3/3] 本地 HTTP 服务器正在后台稳健运行 (http://127.0.0.1:9090)
echo [*] 网页端的 Cookie 会话维系与真实联调环境已全部打通！
echo ====================================================
echo.
echo 【操作指南】
echo 1. 请不要关闭当前命令行窗口。
echo 2. 在打开的 Chrome 浏览器中，即可使用 "手机号" + "888888" 验证码正常进行登录/注册联调。
echo 3. 测试或使用完毕后，在此窗口内按【任意键】即可自动终止后台服务器并安全退出。
echo.
pause

echo.
echo 正在关闭本地服务器并清除临时文件...
if exist "%~dp0server.pid" (
    set /p SERVER_PID=<"%~dp0server.pid"
    taskkill /F /PID %SERVER_PID% >nul 2>&1
    del "%~dp0server.pid" >nul 2>&1
)
echo [✓] 已安全关闭后台服务器并退出联调环境。
timeout /t 2 >nul
