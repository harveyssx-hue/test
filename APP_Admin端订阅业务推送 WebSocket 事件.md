# APP/Admin端订阅业务推送 WebSocket 事件

#### APP/Admin调用流程

1. 客户端调用 `POST /api/v1/auth/ws-ticket`
2. 携带既有 Header：
   * `X-Token`
   * `X-Signature`
   * `X-Timestamp`
   * `X-Device-Id`
   * `X-App-Version`
3. 服务端校验：
   * PASETO 是否有效
   * `sessionKey` 对应 HMAC 是否正确
   * `timestamp` 是否在允许窗口内
   * `deviceId` 是否与会话匹配
4. 返回短时 `ticket`
5. 客户端连接：
   * `wss://api.example.com/ws/v1/biz?ticket=xxx`
6. Gateway 校验票据并绑定 `userId + deviceId + sessionId`

| EventType                               | Module  | Audience  | 状态      | 说明                     |
| --------------------------------------- | ------- | --------- | ------- | ---------------------- |
| `finance.account.changed.v1`            | account | user      | active  | 账户余额变化事件，推送账户最终快照      |
| `finance.deposit.status-changed.v1`     | account | user      | planned | 充值单状态变化                |
| `finance.withdraw.status-changed.v1`    | account | user      | planned | 提现单状态变化                |
| `identity.kyc.status-changed.v1`        | system  | user      | active  | KYC 申请审核状态变化，推送通过/拒绝结果 |
| `trading.order.status-changed.v1`       | order   | user      | planned | 常规交易订单状态变化             |
| `trading.quant.order.status-changed.v1` | order   | user      | active  | AI 量化订单状态变化            |
| `trading.position.closed.v1`            | order   | user      | planned | 持仓结束或平仓完成              |
| `copytrade.follow-order.opened.v1`      | order   | user      | planned | 跟单开仓成功                 |
| `copytrade.follow-order.closed.v1`      | order   | user      | planned | 跟单平仓完成                 |
| `risk.user.alerted.v1`                  | risk    | user      | planned | 用户风控告警，如止损、止盈、暂停       |
| `identity.security.kicked.v1`           | system  | user      | planned | 安全事件，如强制下线、设备踢出        |
| `system.announcement.published.v1`      | system  | broadcast | planned | 系统公告、维护通知              |
| `admin.review.assigned.v1`              | system  | admin     | planned | 后台审核任务分配               |



#### 当前已有事件模型

本节记录当前已经在服务端实现并接入 Biz WebSocket 的事件模型，字段说明应与实际代码保持同步。

#### `finance.account.changed.v1`

用途：

* 用户资金账户发生变化后的最终快照通知
* 同一业务流内多笔记账会在服务端聚合，避免客户端收到逐笔中间态干扰

当前路由：

* `module`: `account`
* `audience`: `app`
* `principalType`: `user`
* `aggregateType`: `accountBalance`
* `aggregateId`: `{accountId}:{assetId}`

字段模型：

| 字段                | 类型                | 说明                                     |
| ----------------- | ----------------- | -------------------------------------- |
| `userId`          | SnowInt           | 用户 ID                                  |
| `accountId`       | SnowInt           | 账户 ID                                  |
| `accountType`     | string            | 账户类型                                   |
| `assetId`         | SnowInt           | 资产 ID                                  |
| `bizId`           | SnowInt           | 业务 ID                                  |
| `ledgerId`        | SnowInt           | 最后一笔账本流水 ID                            |
| `ledgerIds`       | \[]SnowInt        | 本次业务流聚合后的账本流水 ID 列表                    |
| `changeCount`     | int               | 本次业务流聚合的记账笔数                           |
| `bizType`         | ledger.BizType    | 账务业务类型                                 |
| `direction`       | ledger.Direction  | 账务方向，表示入账、出账或冻结态变更                     |
| `actionType`      | ledger.ActionType | 账务动作类型，例如 add、sub、freeze、unfreeze、burn |
| `changeAmount`    | decimal.Decimal   | 最后一笔记账的变动金额                            |
| `totalBefore`     | decimal.Decimal   | 聚合前的总余额快照                              |
| `totalAfter`      | decimal.Decimal   | 聚合后的总余额快照                              |
| `availableBefore` | decimal.Decimal   | 聚合前的可用余额快照                             |
| `availableAfter`  | decimal.Decimal   | 聚合后的可用余额快照                             |
| `frozenBefore`    | decimal.Decimal   | 聚合前的冻结余额快照                             |
| `frozenAfter`     | decimal.Decimal   | 聚合后的冻结余额快照                             |

补充说明：

* 客户端应将该事件视为“最终余额快照”，不要按逐笔流水 UI 直接展示
* 当旧事件超过时效或被更新快照覆盖时，服务端可直接丢弃旧事件

#### `identity.kyc.status-changed.v1`

用途：

* 用户 KYC 审核状态变化通知
* 用于通知用户审核通过、审核拒绝等结果

当前路由：

* `module`: `system`
* `audience`: `app`
* `principalType`: `user`

字段模型：

| 字段           | 类型             | 说明                        |
| ------------ | -------------- | ------------------------- |
| `kycId`      | SnowInt        | KYC 申请记录 ID               |
| `userId`     | SnowInt        | 用户 ID                     |
| `fromStatus` | user.KYCStatus | 变更前状态                     |
| `toStatus`   | user.KYCStatus | 变更后状态                     |
| `approved`   | bool           | 是否审核通过                    |
| `trigger`    | string         | 触发动作，目前为 approve 或 reject |

补充说明：

* 该事件面向用户本人，不向 Admin 广播
* 当前主要用于审核结论触达，后续若引入更细状态流转，应升级版本

#### `trading.quant.order.status-changed.v1`

用途：

* AI 量化交易订单状态变化通知
* 用于通知用户订单创建、审核、取消、结算等关键状态变化

当前路由：

* `module`: `order`
* `audience`: `app`
* `principalType`: `user`

字段模型：

| 字段                 | 类型                       | 说明                                          |
| ------------------ | ------------------------ | ------------------------------------------- |
| `userId`           | SnowInt                  | 用户 ID                                       |
| `orderId`          | SnowInt                  | 量化订单 ID                                     |
| `orderNo`          | string                   | 订单号                                         |
| `algorithmModelId` | SnowInt                  | 算法模型 ID                                     |
| `riskLevel`        | string                   | 风险等级                                        |
| `fromStatus`       | quant.AIQuantOrderStatus | 变更前状态                                       |
| `toStatus`         | quant.AIQuantOrderStatus | 变更后状态                                       |
| `investAmount`     | string                   | 投资金额，按字符串传输                                 |
| `actualProfit`     | string                   | 实际盈亏，按字符串传输                                 |
| `assetFrozenId`    | SnowInt                  | 冻结资产记录 ID                                   |
| `operatorId`       | SnowInt                  | 操作人 ID，系统驱动时可为 0                            |
| `trigger`          | string                   | 触发动作，例如 create、approve、reject、cancel、settle |

补充说明：

* 当前已覆盖创建、审核通过、审核拒绝、用户取消、正常结算、取消结算等状态变化场景
* 若未来增加更多量化生命周期节点，应优先在本节补充模型说明，再扩展客户端消费逻辑
