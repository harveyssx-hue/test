# 1. 接口规范

## 1.1 所有接口前缀

Restful API

```text
/api/v1/xxx
```

Websocket

```text
/ws/v1
```

## 1.2 Header规范

```http
Content-Type: application/json
X-App-Version: 1.0.0
X-Device-Id: xxxxxxxxx
X-Timestamp: 1700000000000
X-Locale: zh-Hans
X-Token: Bearer xxxxxx   （登录后必须）
X-Signature: xxxxxxxxx （登录后必须）
```

说明：

| Header        | 说明                                                         |
| ------------- | ------------------------------------------------------------ |
| X-App-Version | 后续灰度控制                                                 |
| X-Device-Id   | 设备标识                                                     |
| X-Locale      | 语言Tag，格式: `languageCode-scriptCode-countryCode`，<br />其中简体中文为 `zh-Hans`，繁体中文为 `zh-Hant`<br />获取平台支持的 locales： `/common/locales`|
| X-Token       | Paseto                                                       |
| X-Signature   | HMAC(session_key, payload)                                   |
| X-Timestamp   | APP请求时间戳，毫秒/Milli                                    |

# 2. RESTful 接口鉴权模型
## 2.1 API返回数据结构
```json
{
  "code": 200,
  "data": {},
  "paging": {
    "page": 1,
    "pageSize": 30,
    "pages": 10,
    "records": 380
  },
  "errorMessage": ""
}
```
说明：
+ code：API端返回代码，包含http code及业务代码：
  + 200：成功
  + 500：服务器内部错误
  + 401：未登录
  + 403：未授权
  + 其他业务错误代码：不同接口返回的业务错误不同，需阅读具体接口文档
+ data：**可选**，接口返回的数据，可以是单个数据，也可以是数据集
+ paging：**可选**，数据集分页信息
+ errorMessage：**可选**，错误代码对应的错误信息

## 2.2 登录成功返回Token

```json
{
  "accessToken": "",
  "refreshToken": "",
  "accessExpiredAt": 1710000000,
  "refreshExpiredAt": 1710000000,
  "sessionKey": "base64_random_32_bytes",
}
```

+ AccessToken 短期（30分钟）

+ RefreshToken 长期（7天）
+ SessionKey规则

| 属性  | 说明               |
|-----|------------------|
| 长度  | 32字节随机数          |
| 有效期 | 与 accessToken 同步 |
| 存储  | Redis            |
| 失效  | token 失效即失效      |

Redis 结构：

```text
session:{userId}:{deviceId} -> sessionKey
TTL = 30min
```

## 2.3 APP签名规范

### 2.3.1 签名原文构造 - Payload

```text
METHOD + "\n" +
PATH + "\n" +
TIMESTAMP + "\n" +
BODY
```

例如：

```text
POST
/api/v1/order
1700000000000
{"symbol":"BTCUSDT","qty":"1"}
```

签名算法：

```
HMAC-SHA256(sessionKey, payload)
```

输出：

```
hex 小写
```

### 2.3.2 签名原文构造规范 - SIGN-SPEC-1.0

#### 2.3.2.1 参与签名字段

参与签名的字段必须固定为：

```
HTTP_METHOD
REQUEST_PATH
TIMESTAMP
BODY
```

⚠ 不包含：

- 域名
- QueryString（V1 不包含，下面解释）
- Header

#### 2.3.2.2 签名原文拼接规则（严格）

使用换行符 `\n` 拼接：

```
METHOD + "\n" +
PATH + "\n" +
TIMESTAMP + "\n" +
BODY
```

必须满足：

| 项         | 规则                              |
|-----------|---------------------------------|
| METHOD    | 全大写                             |
| PATH      | 必须以 `/` 开头                      |
| TIMESTAMP | 毫秒时间戳字符串，与Header中的X-Timestamp一致 |
| BODY      | 原始 JSON 字符串                     |

#### 2.3.2.3 JSON Body严格规范

1. **JSON 必须“稳定序列化”**

   规则：

   - 字段按 ASCII 字典序排序
   - 不允许多余空格
   - 不允许换行
   - 不允许尾随逗号

   示例：

   正确：

   ```
   {"price":"30000","qty":"1","symbol":"BTCUSDT"}
   ```

   错误：

   ```
   { "symbol":"BTCUSDT","qty":"1","price":"30000" }
   ```

   顺序不同会导致签名不同。

2. **空 Body 规则**

- GET / DELETE 请求
-  POST / PUT 无 Body

统一：

```
BODY = ""
```

不是 null，不是 {}，而是空字符串。

例如：

```text
POST
/api/v1/order
1700000000000
""
```

#### 2.3.2.4 示例

1. 标准POST请求

```
POST
/api/test
1772677618655
{"hello":"world"}
// EOF

签名结果：X-Signaure = "8a7fec0e50ef194e39384050cd604ced7c3c5f3648ca580062d800b16d766a03"
```

2. 无Body请求，例如GET/DELETE，无Body的POST/PUT

```
GET
/api/test
1772677618655

// EOF

签名结果：X-Signaure = "91f2b4596863ce7e52cb6a0cccae72f03af6f0566442682e01a51bb5327a52c4"
```

## 2.4 服务器校验流程

1. 校验 Paseto
2. 获取 uid + deviceId
3. 从 Redis 取 sessionKey
4. 校验 timestamp（±5秒）
5. 重新计算 HMAC
6. 对比签名

失败直接 401。

# 3. 基础防护

## 3.1 接口分级限流（必须）

### 全局限流

- IP：100 req / 10s
- UID：200 req / 10s

### 交易接口单独限流

- 下单：20 / 秒
- 撤单：20 / 秒

不用复杂算法，直接：

```
Redis + 简单滑动窗口
```

## 3.2 提现/资金操作强制二次验证

V1 直接做：

- GA 或 短信

## 3.3 Websocket鉴权

连接方式：

```
wss://api.xxx.com/ws/v1?token=xxxxx
```

服务端：

- 验证 JWT
- 绑定 uid
- 维护连接池

# 4. API调用分层防御模型

## 4.1 Level 0：未登录接口

例如：

- 获取验证码
- 登录
- 公共行情
- 版本检查

只做：

```
TLS
IP限流
设备指纹
行为风控
```

❌ 不强制 sessionKey HMAC

## 4.2 Level 1：已登录用户接口

例如：

- 查询资产
- 查询订单

强制：

```
Paseto
时间戳
Nonce
HMAC(sessionKey)
```

## 4.3 Level 2：交易接口

例如：

- 下单
- 撤单

强制：

```
Paseto
HMAC(sessionKey)
双因子验证（视情况）
风控评分
```

## 4.4 Level 3：提现接口

额外增加：

```
短信 / Google Authenticator
设备指纹强校验
风控评分
冷却时间
```

