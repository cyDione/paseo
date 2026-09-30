# HarmonyOS 测试包

[下载未签名 HAP](https://github.com/cyDione/paseo/raw/refs/heads/feat/harmonyos-pura-x-max/hap/paseo-harmony-unsigned.hap)

- 文件：`paseo-harmony-unsigned.hap`，84,069,626 字节，ARM64
- 应用版本：0.10.0；包名：`sh.paseo.harmony`
- 最低系统：HarmonyOS 6.1 / API 23
- 工具链：官方 DevEco CLI 26.0.0（26.0.0.851），SDK 26.0.0.105 / API 26
- 源码提交：`2ed1cb0e501c96031aaf24a64e995287479cb9cd`

此包未签名，需要使用自己的 DevEco 签名配置签名后安装。Pura X Max 真机验证尚未完成，后台推送尚未启用。

在本目录执行以下命令核对文件完整性：

```sh
sha256sum -c paseo-harmony-unsigned.hap.sha256
```

构建及验证结果见 [harmony-build.json](harmony-build.json)；签名配置和真机验证项目见 [鸿蒙开发说明](../docs/harmony.md)。
