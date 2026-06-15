# MATP Lightweight Native .NET HTTP Server in Pure PowerShell
# Requires zero dependencies (no Node.js, no Python)
# Synchronized with batch file via PID tracking.

$port = 9090
$pidFile = Join-Path $PSScriptRoot "server.pid"

$logFile = Join-Path $PSScriptRoot "server_debug.log"
# Clear log file on startup
Clear-Content -Path $logFile -ErrorAction SilentlyContinue

function Write-Output-Logged {
    param(
        [Parameter(ValueFromPipeline=$true)]
        $InputObject
    )
    process {
        if ($InputObject) {
            $msg = $InputObject.ToString()
            [Console]::WriteLine($msg)
            $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
            "[$timestamp] $msg" | Out-File -FilePath $logFile -Append -Encoding utf8 -ErrorAction SilentlyContinue
        }
    }
}
function Write-Output {
    param([Parameter(ValueFromPipeline=$true)]$InputObject)
    process {
        Write-Output-Logged $InputObject
    }
}
function Write-Host {
    param([Parameter(ValueFromPipeline=$true)]$InputObject)
    process {
        Write-Output-Logged $InputObject
    }
}
function Write-Error {
    param([Parameter(ValueFromPipeline=$true)]$InputObject)
    process {
        Write-Output-Logged "ERROR: $InputObject"
    }
}

# Write PID to file so batch script can kill it cleanly on exit
$PID | Out-File -FilePath $pidFile -Encoding ascii -Force

# Cache for resolved IPs to force IPv4 connection and avoid DNS resolution latency
$script:resolvedIps = @{}
function Get-TargetIP {
    param($domain)
    if ($script:resolvedIps.ContainsKey($domain)) {
        return $script:resolvedIps[$domain]
    }
    try {
        $ips = [System.Net.Dns]::GetHostAddresses($domain)
        $ip = ($ips | Where-Object { $_.AddressFamily -eq 'InterNetwork' } | Select-Object -First 1).ToString()
        if ($ip) {
            $script:resolvedIps[$domain] = $ip
            Write-Host "[DNS] Resolved $domain to IPv4 $ip"
            return $ip
        }
    } catch {
        Write-Host "[DNS] Failed to resolve $domain : $_"
    }
    # Cloudflare fallback IP if resolution fails
    return "104.21.64.132"
}



# Bypass SSL validation globally for proxy requests (as we will connect directly to IP addresses)
[System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }
# OpenAPI contract resolver and generator
$script:openApiMocks = @{}

function Resolve-SchemaRef {
    param($ref, $components)
    if ($ref -match "#/components/schemas/(.+)") {
        $name = $Matches[1]
        return $components.$name
    }
    return $null
}

function Get-SchemaDefault {
    param($schema, $components, $depth = 0)
    if ($depth -gt 4) { return $null } # Circular reference breaker
    if (-not $schema) { return $null }
    
    # Resolve ref
    if ($schema.'$ref') {
        $resolved = Resolve-SchemaRef $schema.'$ref' $components
        return Get-SchemaDefault $resolved $components ($depth + 1)
    }
    
    # Merge allOf
    if ($schema.allOf) {
        $merged = @{}
        foreach ($sub in $schema.allOf) {
            $subVal = Get-SchemaDefault $sub $components ($depth + 1)
            if ($subVal -is [hashtable]) {
                foreach ($k in $subVal.Keys) {
                    $merged[$k] = $subVal[$k]
                }
            }
        }
        return $merged
    }

    # Resolve enum if present
    if ($schema.'enum') {
        return $schema.'enum'[0]
    }
    
    $type = $schema.type
    if ($type -eq "object") {
        $obj = @{}
        if ($schema.properties) {
            foreach ($propName in $schema.properties.psobject.properties.Name) {
                $propSchema = $schema.properties.$propName
                $val = Get-SchemaDefault $propSchema $components ($depth + 1)
                
                # Big Tech quality default generator: check property name for realistic values
                if ($val -eq "mock_str" -or $val -eq 0 -or $val -eq $null) {
                    $lowerName = $propName.ToLower()
                    if ($lowerName -eq "phone") { $val = "+8613800000000" }
                    elseif ($lowerName -eq "email") { $val = "developer@bigtech.com" }
                    elseif ($lowerName -eq "nickname" -or $lowerName -eq "username") { $val = "DevTester" }
                    elseif ($lowerName -eq "uid") { $val = "99887766" }
                    elseif ($lowerName -eq "id" -and ($propSchema.type -eq "integer" -or $propSchema.type -eq "number")) { $val = 123456 }
                    elseif ($lowerName -eq "status") { $val = "ACTIVE" }
                    elseif ($lowerName -eq "kycstatus") { $val = "VERIFIED" }
                    elseif ($lowerName -eq "code" -and ($propSchema.type -eq "integer" -or $propSchema.type -eq "number")) { $val = 200 }
                    elseif ($lowerName -eq "message") { $val = "SUCCESS" }
                }
                $obj[$propName] = $val
            }
        }
        return $obj
    }
    elseif ($type -eq "array") {
        $itemVal = Get-SchemaDefault $schema.items $components ($depth + 1)
        if ($itemVal -ne $null) {
            return @($itemVal)
        }
        return @()
    }
    elseif ($type -eq "string") {
        if ($schema.format -eq "date-time") {
            return (Get-Date -Format "yyyy-MM-ddTHH:mm:ss.fffZ")
        }
        if ($schema.description -like "*time*" -or $schema.description -like "*时间*") {
            return [double]([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())
        }
        return "mock_str"
    }
    elseif ($type -eq "integer" -or $type -eq "number") {
        return 0
    }
    elseif ($type -eq "boolean") {
        return $false
    }
    return $null
}

function Initialize-OpenApiMocks {
    $apiFile = Join-Path $PSScriptRoot "openapi.json"
    if (-not (Test-Path $apiFile)) {
        Write-Host "[MOCK] openapi.json not found, dynamic mock templates fallback disabled."
        return
    }
    
    try {
        Write-Host "[MOCK] Parsing openapi.json contract definitions..."
        $content = [System.IO.File]::ReadAllText($apiFile, [System.Text.Encoding]::UTF8)
        $doc = $content | ConvertFrom-Json
        $components = $doc.components.schemas
        
        foreach ($pathName in $doc.paths.psobject.properties.Name) {
            $pathObj = $doc.paths.$pathName
            foreach ($methodName in $pathObj.psobject.properties.Name) {
                if ($methodName -eq "parameters") { continue }
                $methodObj = $pathObj.$methodName
                $response200 = $methodObj.responses.'200'
                if ($response200) {
                    $schema = $response200.content.'application/json'.schema
                    if ($schema) {
                        $defaultVal = Get-SchemaDefault $schema $components
                        $finalPayload = @{}
                        if ($defaultVal -is [hashtable]) {
                            if ($defaultVal.ContainsKey("code") -and $defaultVal.ContainsKey("message")) {
                                $finalPayload = $defaultVal
                            } else {
                                $finalPayload["code"] = 200
                                $finalPayload["message"] = "SUCCESS"
                                $finalPayload["data"] = $defaultVal
                            }
                        } else {
                            $finalPayload["code"] = 200
                            $finalPayload["message"] = "SUCCESS"
                            $finalPayload["data"] = $defaultVal
                        }
                        
                        $json = ConvertTo-Json -InputObject $finalPayload -Depth 10 -Compress
                        $key = "$($methodName.ToUpper()):/api/v1$($pathName)"
                        $script:openApiMocks[$key] = $json
                    }
                }
            }
        }
        Write-Host "[MOCK] Loaded $($script:openApiMocks.Count) OpenAPI schema contracts into memory."
    } catch {
        Write-Host "[MOCK] Error parsing openapi.json: $_"
    }
}

function Get-OpenApiMockResponse {
    param($method, $localPath)
    
    $exactKey = "$method`:$localPath"
    if ($script:openApiMocks.ContainsKey($exactKey)) {
        return $script:openApiMocks[$exactKey]
    }
    
    foreach ($key in $script:openApiMocks.Keys) {
        if ($key -like "*{*}*") {
            $pattern = "^" + ([Regex]::Escape($key) -replace "\\{[^\\}]+\\}", "[^/]+") + "$"
            if ($exactKey -match $pattern) {
                return $script:openApiMocks[$key]
            }
        }
    }
    return $null
}

function Test-BackendConnection {
    param($domain)
    try {
        $url = "https://$domain/api/v1/common/configs"
        if ($domain -like "*admin*") {
            $url = "https://$domain/api/v1/auth/status"
        }
        $req = [System.Net.HttpWebRequest]::Create($url)
        $req.Method = "GET"
        $req.Timeout = 1500  # 1.5 seconds timeout
        $res = $req.GetResponse()
        $statusCode = [int]$res.StatusCode
        $res.Close()
        if ($statusCode -eq 200 -or $statusCode -eq 401 -or $statusCode -eq 403) {
            return $true
        }
    } catch {
        # WebException with a response means the host resolved and responded, so it is online
        $ex = $_.Exception
        while ($ex -and $ex.InnerException) { $ex = $ex.InnerException }
        if ($ex -and $ex.GetType().Name -eq "WebException") {
            $res = $ex.Response
            if ($res) {
                $statusCode = [int]$res.StatusCode
                $res.Close()
                return $true
            }
        }
    }
    return $false
}

function Get-MockFileResponse {
    param($method, $localPath)
    
    # 1. 精确匹配 (Exact Match)
    $exactPath = [System.IO.Path]::Combine($PSScriptRoot, "mocks", $method, $localPath.TrimStart('/')) + ".json"
    if (Test-Path $exactPath -PathType Leaf) {
        return $exactPath
    }
    
    # 2. OpenAPI 路径模板匹配 (OpenAPI Template Match)
    $exactKey = "$method`:$localPath"
    foreach ($key in $script:openApiMocks.Keys) {
        if ($key -like "*{*}*") {
            $pattern = "^" + ([Regex]::Escape($key) -replace "\\{[^\\}]+\\}", "[^/]+") + "$"
            if ($exactKey -match $pattern) {
                # 提取模板路径部分 (例如 "GET:/api/v1/finance/accounts/{id}/balances" -> "/api/v1/finance/accounts/{id}/balances")
                $parts = $key -split ':', 2
                $templatePath = $parts[1]
                $templateFile = [System.IO.Path]::Combine($PSScriptRoot, "mocks", $method, $templatePath.TrimStart('/')) + ".json"
                if (Test-Path $templateFile -PathType Leaf) {
                    return $templateFile
                }
            }
        }
    }
    
    # 3. 剥离动态参数降级匹配 (Simplified Fallback Match)
    # 替换数字 ID 路径段
    $cleanedPath = $localPath -replace "/\d+/", "/"
    $cleanedPath = $cleanedPath -replace "/\d+$", ""
    # 替换 UUID/GUID 路径段
    $cleanedPath = $cleanedPath -replace "/[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}/", "/"
    $cleanedPath = $cleanedPath -replace "/[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$", ""
    
    $fallbackFile = [System.IO.Path]::Combine($PSScriptRoot, "mocks", $method, $cleanedPath.TrimStart('/')) + ".json"
    if (Test-Path $fallbackFile -PathType Leaf) {
        return $fallbackFile
    }
    
    return $null
}

function Get-StrategyExtraData {
    $filePath = Join-Path $PSScriptRoot "mocks/strategy_extra_data.json"
    $hash = @{}
    
    if (Test-Path $filePath) {
        try {
            $content = Get-Content $filePath -Raw -ErrorAction SilentlyContinue
            $obj = ConvertFrom-Json $content
            foreach ($prop in $obj.PSObject.Properties) {
                $hash[$prop.Name] = @{
                    yield = [double]$prop.Value.yield
                    winRate = [double]$prop.Value.winRate
                    followers = [int]$prop.Value.followers
                }
            }
            return $hash
        } catch {
            Write-Output "[WARN] Failed to parse strategy_extra_data.json: $_"
        }
    }
    
    $hash["1194952042687242240"] = @{ yield = 32.58; winRate = 87.3; followers = 12483 }
    $hash["1194953086448181248"] = @{ yield = 24.17; winRate = 81.6; followers = 8392 }
    $hash["1194953408742694912"] = @{ yield = 48.72; winRate = 78.9; followers = 6721 }
    $hash["1194953853921927168"] = @{ yield = 19.35; winRate = 79.2; followers = 5231 }
    
    try {
        $json = $hash | ConvertTo-Json -Depth 5
        $mocksDir = Join-Path $PSScriptRoot "mocks"
        if (-not (Test-Path $mocksDir)) { New-Item -ItemType Directory -Path $mocksDir -Force | Out-Null }
        [System.IO.File]::WriteAllText($filePath, $json)
    } catch {}
    
    return $hash
}

function Save-StrategyExtraData($strategyId, $yield, $winRate, $followers) {
    $filePath = Join-Path $PSScriptRoot "mocks/strategy_extra_data.json"
    $data = Get-StrategyExtraData
    
    $data[[string]$strategyId] = @{
        yield = [double]$yield
        winRate = [double]$winRate
        followers = [int]$followers
    }
    
    try {
        $json = $data | ConvertTo-Json -Depth 5
        [System.IO.File]::WriteAllText($filePath, $json)
        Write-Output "[LOCAL STORAGE] Strategy $strategyId extra stats saved -> yield: $yield, winRate: $winRate, followers: $followers"
    } catch {
        Write-Output "[ERROR] Failed to save strategy extra stats: $_"
    }
}

# Initialize HTTP Listener
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$port/")

$script:offlineSandbox = $false

try {
    $listener.Start()
    Write-Host "PowerShell HTTP Server started at http://127.0.0.1:$port/"
    
    Write-Host "[INIT] Testing connection to remote backend domains..."
    $appOnline = Test-BackendConnection "matp-app.qchats.org"
    $adminOnline = Test-BackendConnection "matp-admin.qchats.org"
    if (-not $appOnline -and -not $adminOnline) {
        Write-Host "[WARNING] REMOTE BACKENDS ARE OFFLINE/UNREACHABLE. Request proxying might fail."
    } else {
        Write-Host "[INIT] Remote backend is online. Proxy mode active."
    }
} catch {
    Write-Error "Failed to start HTTP listener on port $($port): $_"
    if (Test-Path $pidFile) { Remove-Item $pidFile -Force }
    exit
}

# Serve loop: standard blocking GetContext (very stable, no resource leaks)
while ($listener.IsListening) {
    $context = $null
    $response = $null
    try {
        $context = $listener.GetContext()
    } catch {
        # Listener was stopped or closed
        break
    }
    
    # Process request in a try-finally block to guarantee response closure (prevents loading hang)
    try {
        $request = $context.Request
        $response = $context.Response
        
        # Handle Preflight OPTIONS requests for CORS
        if ($request.HttpMethod -eq "OPTIONS") {
            $response.StatusCode = 200
            $response.Headers.Set("Access-Control-Allow-Origin", "http://127.0.0.1:9090")
            $response.Headers.Set("Access-Control-Allow-Credentials", "true")
            $response.Headers.Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
            $response.Headers.Set("Access-Control-Allow-Headers", "Content-Type, X-Requested-With, X-Token, X-Signature, X-Timestamp, X-Locale, X-App-Version, X-Device-Id")
            try { $response.OutputStream.Close() } catch {}
            continue
        }

        # Local Upload handler for Admin panel strategy icons
        if ($request.Url.LocalPath -eq "/upload-local") {
            $fileName = $request.QueryString["fileName"]
            if (-not $fileName) {
                $response.StatusCode = 400
                try { $response.OutputStream.Close() } catch {}
                continue
            }
            
            # Read request body fully
            $reqBodyBytes = New-Object System.IO.MemoryStream
            $request.InputStream.CopyTo($reqBodyBytes)
            $reqBodyData = $reqBodyBytes.ToArray()
            
            Write-Output "[LOCAL UPLOAD] Saving file -> $fileName (Size: $($reqBodyData.Length) bytes)"
            
            # Ensure uploads directory exists
            $uploadsDir = [System.IO.Path]::Combine($PSScriptRoot, "uploads")
            if (-not (Test-Path $uploadsDir)) {
                New-Item -ItemType Directory -Path $uploadsDir -Force | Out-Null
            }
            
            # Save file
            $filePath = [System.IO.Path]::Combine($uploadsDir, $fileName)
            [System.IO.File]::WriteAllBytes($filePath, $reqBodyData)
            
            $response.StatusCode = 200
            
            # CORS headers
            $response.Headers.Set("Access-Control-Allow-Origin", "http://127.0.0.1:9090")
            $response.Headers.Set("Access-Control-Allow-Credentials", "true")
            $response.Headers.Set("Access-Control-Allow-Methods", "PUT, OPTIONS")
            $response.Headers.Set("Access-Control-Allow-Headers", "Content-Type")
            
            try { $response.OutputStream.Close() } catch {}
            continue
        }

        # GCS PUT Reverse Proxy to bypass GCS CORS limitation on localhost/127.0.0.1
        if ($request.Url.LocalPath -eq "/upload-gcs") {
            $targetUrl = $request.QueryString["url"]
            if (-not $targetUrl) {
                $response.StatusCode = 400
                try { $response.OutputStream.Close() } catch {}
                continue
            }

            # Read request body fully
            $reqBodyBytes = New-Object System.IO.MemoryStream
            $request.InputStream.CopyTo($reqBodyBytes)
            $reqBodyData = $reqBodyBytes.ToArray()

            Write-Output "[GCS PROXY] PUT -> $targetUrl (Size: $($reqBodyData.Length) bytes)"

            # Build proxy Web Request direct to GCS
            $gcsReq = [System.Net.HttpWebRequest]::Create($targetUrl)
            $gcsReq.Method = "PUT"
            $gcsReq.ContentType = if ($request.ContentType) { $request.ContentType } else { "image/jpeg" }
            $gcsReq.ContentLength = $reqBodyData.Length

            if ($reqBodyData.Length -gt 0) {
                $reqStream = $gcsReq.GetRequestStream()
                $reqStream.Write($reqBodyData, 0, $reqBodyData.Length)
                $reqStream.Close()
            }

            try {
                $gcsRes = $gcsReq.GetResponse()
                $response.StatusCode = [int]$gcsRes.StatusCode
                $gcsRes.Close()
            } catch {
                $ex = $_.Exception
                while ($ex -and $ex.InnerException) { $ex = $ex.InnerException }
                if ($ex -and $ex.GetType().Name -eq "WebException") {
                    $response.StatusCode = [int]$ex.Response.StatusCode
                    try {
                        $stream = $ex.Response.GetResponseStream()
                        $reader = New-Object System.IO.StreamReader($stream)
                        $errText = $reader.ReadToEnd()
                        $reader.Close()
                        $stream.Close()
                        Write-Output "[ERROR] GCS PUT returned Status $($response.StatusCode): $errText"
                    } catch {
                        Write-Output "[ERROR] GCS PUT WebException: $_"
                    }
                } else {
                    Write-Output "[ERROR] GCS PUT failed: $_"
                    $response.StatusCode = 500
                }
            }

            # Enforce Same-Origin CORS policies to enable browser access
            $response.Headers.Set("Access-Control-Allow-Origin", "http://127.0.0.1:9090")
            $response.Headers.Set("Access-Control-Allow-Credentials", "true")
            $response.Headers.Set("Access-Control-Allow-Methods", "PUT, OPTIONS")
            $response.Headers.Set("Access-Control-Allow-Headers", "Content-Type")

            try { $response.OutputStream.Close() } catch {}
            continue
        }

        # GCS GET Reverse Proxy to preview/download images locally bypassing CORS & potential network block
        if ($request.Url.LocalPath -eq "/download-gcs") {
            $targetUrl = $request.QueryString["url"]
            if (-not $targetUrl) {
                $response.StatusCode = 400
                try { $response.OutputStream.Close() } catch {}
                continue
            }

            Write-Output "[GCS PROXY] GET -> $targetUrl"

            # Build proxy GET Web Request
            $gcsReq = [System.Net.HttpWebRequest]::Create($targetUrl)
            $gcsReq.Method = "GET"
            $gcsReq.Timeout = 10000  # 10s timeout
            $gcsReq.UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"

            try {
                $gcsRes = $gcsReq.GetResponse()
                $response.StatusCode = [int]$gcsRes.StatusCode
                
                # Copy Content-Type if present, default to image/jpeg
                $resContentType = $gcsRes.ContentType
                if (-not $resContentType) {
                    $resContentType = "image/jpeg"
                }
                $response.ContentType = $resContentType

                # Read response binary stream
                $resStream = $gcsRes.GetResponseStream()
                $resBytes = New-Object System.IO.MemoryStream
                $resStream.CopyTo($resBytes)
                $resData = $resBytes.ToArray()

                $response.ContentLength64 = $resData.Length
                $response.OutputStream.Write($resData, 0, $resData.Length)

                $resStream.Close()
                $gcsRes.Close()
            } catch {
                $ex = $_.Exception
                while ($ex -and $ex.InnerException) { $ex = $ex.InnerException }
                if ($ex -and $ex.GetType().Name -eq "WebException") {
                    $response.StatusCode = [int]$ex.Response.StatusCode
                    Write-Output "[ERROR] GCS GET failed with status: $($response.StatusCode)"
                } else {
                    Write-Output "[ERROR] GCS GET request failed: $_"
                    $response.StatusCode = 500
                }
            }

            # CORS headers to enable browser access
            $response.Headers.Set("Access-Control-Allow-Origin", "http://127.0.0.1:9090")
            $response.Headers.Set("Access-Control-Allow-Credentials", "true")

            try { $response.OutputStream.Close() } catch {}
            continue
        }
        
        # Serve openapi.json locally to prevent proxy timeouts
        if ($request.Url.LocalPath -eq "/openapi.json") {
            $apiFile = Join-Path $PSScriptRoot "openapi.json"
            if (Test-Path $apiFile -PathType Leaf) {
                $response.StatusCode = 200
                $response.ContentType = "application/json; charset=utf-8"
                $response.Headers.Set("Access-Control-Allow-Origin", "*")
                $bytes = [System.IO.File]::ReadAllBytes($apiFile)
                $response.ContentLength64 = $bytes.Length
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
                try { $response.OutputStream.Close() } catch {}
                continue
            }
        }
        
        # 1. Proxy Handler for /api/v1/ REST requests (PURE PROXY MODE, NO MOCK FALLBACKS)
        $reqPath = $request.Url.LocalPath
        $hasAdminProxy = $false
        if ($reqPath.StartsWith("/admin-proxy/")) {
            $reqPath = $reqPath.Substring(12)
            $hasAdminProxy = $true
        }

        if ($reqPath.StartsWith("/api/v1/")) {
            $reqMethod = $request.HttpMethod

            if ($reqPath -eq "/api/v1/common/upload/presigned" -or $reqPath -eq "/api/v1/upload/presigned") {
                # Intercept presigned upload URL requests for admin panel to bypass 401 Unauthorized
                $referer = $request.Headers["Referer"]
                $accessToken = $request.Headers["X-Token"]
                if ($hasAdminProxy -or ($referer -and $referer.Contains("admin")) -or -not $accessToken -or $accessToken -eq "Bearer null" -or $accessToken -eq "Bearer undefined") {
                    Write-Output "[LOCAL UPLOAD] Mocking presigned URL for admin panel"
                    
                    # Generate a unique path
                    $timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds().ToString()
                    $fileName = "strategy_icon_" + $timestamp + ".png"
                    
                    $response.StatusCode = 200
                    $response.ContentType = "application/json; charset=utf-8"
                    $response.Headers.Set("Access-Control-Allow-Origin", "http://127.0.0.1:9090")
                    $response.Headers.Set("Access-Control-Allow-Credentials", "true")
                    
                    $uploadUrl = "http://127.0.0.1:9090/upload-local?fileName=" + $fileName
                    $downloadUrl = "http://127.0.0.1:9090/uploads/" + $fileName
                    $storagePath = "uploads/" + $fileName
                    
                    $resJson = @{
                        code = 200
                        message = "SUCCESS"
                        data = @{
                            uploadUrl = $uploadUrl
                            downloadUrl = $downloadUrl
                            path = $storagePath
                        }
                    } | ConvertTo-Json -Compress
                    
                    $resData = [System.Text.Encoding]::UTF8.GetBytes($resJson)
                    $response.ContentLength64 = $resData.Length
                    $response.OutputStream.Write($resData, 0, $resData.Length)
                    try { $response.OutputStream.Close() } catch {}
                    continue
                }
            }
            
            if ($reqPath -eq "/api/v1/common/upload/confirm" -or $reqPath -eq "/api/v1/upload/confirm") {
                # Intercept confirm upload requests for local uploads
                $referer = $request.Headers["Referer"]
                $accessToken = $request.Headers["X-Token"]
                if ($hasAdminProxy -or ($referer -and $referer.Contains("admin")) -or -not $accessToken -or $accessToken -eq "Bearer null" -or $accessToken -eq "Bearer undefined") {
                    Write-Output "[LOCAL UPLOAD] Mocking confirm for admin panel"
                    $response.StatusCode = 200
                    $response.ContentType = "application/json; charset=utf-8"
                    $response.Headers.Set("Access-Control-Allow-Origin", "http://127.0.0.1:9090")
                    $response.Headers.Set("Access-Control-Allow-Credentials", "true")
                    
                    $resJson = @{
                        code = 200
                        message = "SUCCESS"
                        data = $null
                    } | ConvertTo-Json -Compress
                    
                    $resData = [System.Text.Encoding]::UTF8.GetBytes($resJson)
                    $response.ContentLength64 = $resData.Length
                    $response.OutputStream.Write($resData, 0, $resData.Length)
                    try { $response.OutputStream.Close() } catch {}
                    continue
                }
            }
            
            $referer = $request.Headers["Referer"]
            $isAdmin = $hasAdminProxy
            if (-not $hasAdminProxy) {
                if ($referer) {
                    if ($referer.Contains("admin")) {
                        $isAdmin = $true
                    }
                } else {
                    # Fallback to path-based check ONLY if Referer is missing
                    if ($request.Url.LocalPath.Contains("/users") -or 
                        $request.Url.LocalPath.Contains("/trading/quant/orders") -or 
                        $request.Url.LocalPath.Contains("/auth/status") -or 
                        $request.Url.LocalPath.Contains("/auth/ws-ticket") -or 
                        $request.Url.LocalPath.Contains("/platform-contents") -or 
                        $request.Url.LocalPath.Contains("/tenants") -or 
                        $request.Url.LocalPath.Contains("/finance/") -or 
                        $request.Url.LocalPath.Contains("/copy-trading/") -or 
                        $request.Url.LocalPath.Contains("/instruments") -or 
                        $request.Url.LocalPath.Contains("/moments") -or 
                        $request.Url.LocalPath.Contains("/support-channels") -or 
                        $request.Url.LocalPath.Contains("/exchanges")) {
                        $isAdmin = $true
                    }
                }
                
                # Absolute Overrides:
                # 1. Requests with X-Token or X-Signature are strictly User App requests
                if ($request.Headers["X-Token"] -or $request.Headers["X-Signature"]) {
                    $isAdmin = $false
                }
                # 2. Key User endpoints must never go to Admin backend
                if ($request.Url.LocalPath.Contains("/users/info") -or 
                    $request.Url.LocalPath.Contains("/users/kyc/info") -or 
                    $request.Url.LocalPath.Contains("/users/referral") -or 
                    $request.Url.LocalPath.Contains("/common/")) {
                    $isAdmin = $false
                }
            }
            
            $targetDomain = if ($isAdmin) { "matp-admin.qchats.org" } else { "matp-app.qchats.org" }
            $targetIP = Get-TargetIP $targetDomain
            $pathAndQuery = $request.Url.PathAndQuery
            if ($hasAdminProxy) {
                $pathAndQuery = $pathAndQuery -replace "^/admin-proxy", ""
            }
            $targetUrl = "https://" + $targetIP + $pathAndQuery
            Write-Output "[PROXY] $($request.HttpMethod) $pathAndQuery -> $targetUrl (Host: $targetDomain)"
            
            # Read request body fully
            $reqBodyBytes = New-Object System.IO.MemoryStream
            $request.InputStream.CopyTo($reqBodyBytes)
            $reqBodyData = $reqBodyBytes.ToArray()
            
            if ($reqBodyData.Length -gt 0) {
                $bodyText = [System.Text.Encoding]::UTF8.GetString($reqBodyData)
                Write-Output "[PROXY] Body: $bodyText"
            }
            
            # Build proxy Web Request
            $proxyReq = [System.Net.HttpWebRequest]::Create($targetUrl)
            $proxyReq.Host = $targetDomain
            $proxyReq.Method = $request.HttpMethod
            $proxyReq.Timeout = 30000  # 30 seconds timeout to prevent hanging the single-threaded server on backend timeout
            $proxyReq.AutomaticDecompression = [System.Net.DecompressionMethods]::GZip -bor [System.Net.DecompressionMethods]::Deflate
            
            # Copy incoming headers to proxy request
            foreach ($h in $request.Headers.AllKeys) {
                if ($h -eq "Host" -or $h -eq "Content-Length" -or $h -eq "Connection" -or $h -eq "Accept-Encoding") { continue }
                if (-not $isAdmin -and $h -eq "Cookie") { continue }
                try {
                    $proxyReq.Headers.Add($h, $request.Headers[$h])
                } catch {
                    if ($h -eq "Content-Type") { $proxyReq.ContentType = $request.Headers[$h] }
                    elseif ($h -eq "User-Agent") { $proxyReq.UserAgent = $request.Headers[$h] }
                    elseif ($h -eq "Referer") { $proxyReq.Referer = $request.Headers[$h] }
                }
            }
            
            # Write body data if present
            if ($reqBodyData.Length -gt 0) {
                $proxyReq.ContentLength = $reqBodyData.Length
                $reqStream = $proxyReq.GetRequestStream()
                $reqStream.Write($reqBodyData, 0, $reqBodyData.Length)
                $reqStream.Close()
            }
            
            # Obtain response from target API
            $proxyRes = $null
            $proxyFailed = $false
            $errorMsg = ""
            try {
                $proxyRes = $proxyReq.GetResponse()
            } catch {
                $ex = $_.Exception
                while ($ex -and $ex.InnerException) { $ex = $ex.InnerException }
                if ($ex -and $ex.GetType().Name -eq "WebException") {
                    $proxyRes = $ex.Response
                    if (-not $proxyRes) {
                        $proxyFailed = $true
                        $errorMsg = $ex.Message
                    }
                } else {
                    Write-Output "[ERROR] Proxy Web Request failed: $_"
                    $proxyFailed = $true
                    $errorMsg = $_.ToString()
                }
            }
            
            if ($proxyFailed) {
                Write-Host "[ERROR] Proxy connection failed: $errorMsg. Returning HTTP 502 Bad Gateway."
                $response.StatusCode = 502
                $response.ContentType = "application/json; charset=utf-8"
                $response.Headers.Set("Access-Control-Allow-Origin", "http://127.0.0.1:9090")
                $response.Headers.Set("Access-Control-Allow-Credentials", "true")
                $errorJson = '{"code":502,"message":"Bad Gateway - Proxy connection failed"}'
                $resData = [System.Text.Encoding]::UTF8.GetBytes($errorJson)
                $response.ContentLength64 = $resData.Length
                $response.OutputStream.Write($resData, 0, $resData.Length)
                try { $response.OutputStream.Close() } catch {}
                continue
            } else {
                $statusCode = [int]$proxyRes.StatusCode
                $response.StatusCode = $statusCode
                
                # Copy response headers back
                foreach ($h in $proxyRes.Headers.AllKeys) {
                    if ($h -eq "Transfer-Encoding" -or $h -eq "Content-Length" -or $h -eq "Access-Control-Allow-Origin" -or $h -eq "Access-Control-Allow-Credentials") { continue }
                    if ($h -eq "Set-Cookie") {
                        try {
                            $cookies = $proxyRes.Headers.GetValues($h)
                            foreach ($cookie in $cookies) {
                                # Strip Domain and Secure attribute, and rewrite SameSite to Lax
                                $cleanCookie = $cookie -replace 'Domain=[^;]+;?\s*', ''
                                $cleanCookie = $cleanCookie -replace 'Secure;?\s*', ''
                                if ($cleanCookie -like "*SameSite=*") {
                                    $cleanCookie = $cleanCookie -replace 'SameSite=[a-zA-Z]+', 'SameSite=Lax'
                                } else {
                                    $cleanCookie = $cleanCookie + "; SameSite=Lax"
                                }
                                $cleanCookie = $cleanCookie -replace ';\s*;', ';'
                                $cleanCookie = $cleanCookie.TrimEnd(';').Trim()
                                $response.Headers.Add("Set-Cookie", $cleanCookie)
                            }
                        } catch {}
                        continue
                    }
                    try {
                        $response.Headers.Add($h, $proxyRes.Headers[$h])
                    } catch {}
                }
                
                # Enforce Same-Origin CORS policies to enable cookie access
                $response.Headers.Set("Access-Control-Allow-Origin", "http://127.0.0.1:9090")
                $response.Headers.Set("Access-Control-Allow-Credentials", "true")
                
                # Copy body stream
                $resStream = $proxyRes.GetResponseStream()
                $resBytes = New-Object System.IO.MemoryStream
                $resStream.CopyTo($resBytes)
                $resData = $resBytes.ToArray()
                
                # Log response status and body for debugging
                $resBodyText = [System.Text.Encoding]::UTF8.GetString($resData)
                Write-Output "[PROXY] Response: HTTP $($response.StatusCode) | $resBodyText"
                
                # Intercept and enrich or save strategy extra data
                if ($statusCode -eq 200 -and $resBodyText -like "*code*200*") {
                    if ($reqPath -eq "/api/v1/trading/quant/config" -or $reqPath -eq "/api/v1/trading/quant/algorithm-models") {
                        try {
                            $jsonObj = ConvertFrom-Json $resBodyText
                            $extraData = Get-StrategyExtraData
                            
                            # Merge logic
                            if ($reqPath -eq "/api/v1/trading/quant/config") {
                                $models = $jsonObj.data.models
                                if ($models) {
                                    foreach ($m in $models) {
                                        $sid = [string]$m.id
                                        if ($extraData.ContainsKey($sid)) {
                                            $m | Add-Member -MemberType NoteProperty -Name "yield" -Value $extraData[$sid].yield -Force
                                            $m | Add-Member -MemberType NoteProperty -Name "winRate" -Value $extraData[$sid].winRate -Force
                                            $m | Add-Member -MemberType NoteProperty -Name "followers" -Value $extraData[$sid].followers -Force
                                        }
                                    }
                                }
                            } else {
                                $models = $jsonObj.result
                                if (-not $models) { $models = $jsonObj.data }
                                if ($models) {
                                    foreach ($m in $models) {
                                        $sid = [string]$m.id
                                        if ($extraData.ContainsKey($sid)) {
                                            $m | Add-Member -MemberType NoteProperty -Name "yield" -Value $extraData[$sid].yield -Force
                                            $m | Add-Member -MemberType NoteProperty -Name "winRate" -Value $extraData[$sid].winRate -Force
                                            $m | Add-Member -MemberType NoteProperty -Name "followers" -Value $extraData[$sid].followers -Force
                                        }
                                    }
                                }
                            }
                            
                            $resBodyText = $jsonObj | ConvertTo-Json -Depth 10 -Compress
                            $resData = [System.Text.Encoding]::UTF8.GetBytes($resBodyText)
                            Write-Output "[PROXY] Merged local strategy extra stats into response"
                        } catch {
                            Write-Output "[WARN] Failed to merge local strategy extra stats: $_"
                        }
                    } elseif ($request.HttpMethod -eq "POST" -and $reqPath.StartsWith("/api/v1/trading/quant/algorithm-models")) {
                        try {
                            if ($bodyText) {
                                $reqObj = ConvertFrom-Json $bodyText
                                $resObj = ConvertFrom-Json $resBodyText
                                
                                $strategyId = $reqPath.Substring($reqPath.LastIndexOf('/') + 1)
                                if ($strategyId -eq "algorithm-models") {
                                    $strategyId = $resObj.result.id
                                    if (-not $strategyId) { $strategyId = $resObj.data.id }
                                }
                                
                                if ($strategyId -and ($reqObj.yield -ne $null -or $reqObj.winRate -ne $null -or $reqObj.followers -ne $null)) {
                                    Save-StrategyExtraData -strategyId $strategyId -yield $reqObj.yield -winRate $reqObj.winRate -followers $reqObj.followers
                                }
                            }
                        } catch {
                            Write-Output "[WARN] Failed to parse request/response for strategy save: $_"
                        }
                    }
                }
                
                $response.ContentLength64 = $resData.Length
                $response.OutputStream.Write($resData, 0, $resData.Length)
                
                $resStream.Close()
                $proxyRes.Close()
                try { $response.OutputStream.Close() } catch {}
                continue
            }
        }
        
        $urlPath = $request.Url.LocalPath.TrimStart('/')
        if ($urlPath -eq "") { 
            $urlPath = "index.html" 
        }
        
        # Decode URL encoding safely
        $urlPath = [System.Uri]::UnescapeDataString($urlPath)
        
        $filePath = Join-Path $PSScriptRoot $urlPath
        
        # Favicon.ico Graceful Fallback to prevent 404 errors in browser console
        if ($urlPath -eq "favicon.ico" -and -not (Test-Path $filePath -PathType Leaf)) {
            $response.StatusCode = 204  # No Content
            try { $response.OutputStream.Close() } catch {}
            continue
        }
        
        if (Test-Path $filePath -PathType Leaf) {
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            
            # MIME Types mapper
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $contentType = "application/octet-stream"
            if ($ext -eq ".html") { $contentType = "text/html; charset=utf-8" }
            elseif ($ext -eq ".css") { $contentType = "text/css; charset=utf-8" }
            elseif ($ext -eq ".js") { $contentType = "application/javascript; charset=utf-8" }
            elseif ($ext -eq ".json") { $contentType = "application/json; charset=utf-8" }
            elseif ($ext -eq ".png") { $contentType = "image/png" }
            elseif ($ext -eq ".jpg" -or $ext -eq ".jpeg") { $contentType = "image/jpeg" }
            elseif ($ext -eq ".svg") { $contentType = "image/svg+xml" }
            elseif ($ext -eq ".ico") { $contentType = "image/x-icon" }
            
            $response.ContentType = $contentType
            $response.ContentLength64 = $bytes.Length
            
            # CORS headers
            $response.Headers.Add("Access-Control-Allow-Origin", "*")
            $response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            $response.Headers.Add("Access-Control-Allow-Headers", "Content-Type")
            
            # Disable browser caching for development
            $response.Headers.Add("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
            $response.Headers.Add("Pragma", "no-cache")
            $response.Headers.Add("Expires", "0")
            
            if ($request.HttpMethod -ne "HEAD") {
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
            }
        } else {
            $response.StatusCode = 404
        }
    } catch {
        Write-Output "[ERROR] Processing request $($request.Url.LocalPath): $_"
        if ($response) {
            $response.StatusCode = 500
        }
    } finally {
        if ($response) {
            try {
                $response.OutputStream.Close()
            } catch {}
        }
    }
}

# Clean shutdown
try {
    $listener.Stop()
    $listener.Close()
} catch {}

if (Test-Path $pidFile) {
    Remove-Item $pidFile -Force
}
Write-Host "PowerShell HTTP Server stopped safely."
