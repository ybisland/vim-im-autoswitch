# vim-im-autoswitch 

## 仓库描述

该插件实现在VSCodeVim的模式切换时，自动更改输入法的中英文模式。该插件需要结合VSCodeVim插件使用。

目标用户：

在Windows平台上使用搜狗输入法等中文输入法，且因为中英文切换感到头疼的VSCodeVim用户.


## 使用方法

### 前提
- Windows平台
- 已安装VSCodeVim插件
- VSCodeVim在Insert模式和Normal模式下光标类型不同（由于VSCodeVim没有导出vim.mode状态，只能通过检测光标类型来检测不同模式）
- 不是所有中文输入法都支持该插件，见输入法支持列表

### 输入法支持列表

支持的输入法（数字代表对应中英文模式）：
- 搜狗输入法15.3.0正式版：1->中文模式，0->英文模式
- 百度输入法（待测试，应该可用）
- 讯飞输入法（待测试，中英文模式代码应该是和搜狗输入法相反）

不支持的输入法：
- 微软拼音

### Extension Settings

插件默认设置如下：
```
"vim-im-autoswitch.enable": true,
"vim-im-autoswitch.default IME State for Normal Mode": 0,
"vim-im-autoswitch.default IME State for Insert Mode": 1,
"vim-im-autoswitch.rememberLastIMEState": true
```

`vim-im-autoswitch.enable`：是否启用该插件

`vim-im-autoswitch.default IME State for Normal Mode`代表进入Normal模式时，输入法要切换成什么模式。例如，搜狗输入法的英文模式代码为0，这里填0。

`vim-im-autoswitch.default IME State for Insert Mode`代表进入Insert模式时，输入法要切换成什么模式。以搜狗输入法为例，如果想要中文模式，这里填1；如果想要英文模式，这里填0。

`vim-im-autoswitch.rememberLastIMEState`：是否记忆上次Insert模式的状态。若开启，则下次进入Insert模式时自动变成上次Insert模式中的中英文状态。

### 中英文状态码说明

对于未测试过的中文输入法，可以自行测试其中英文模式的状态码。如果测试出来中英文模式的状态码不同则可用，如果相同则该插件不可用。

测试方法：

在中文模式下运行命令`check IME State`并记录状态码，再切换到英文模式测试状态码。

## 后续计划
- 测试不同输入法



## 碎碎念

对于**在Windows平台进行软件开发的VSCodeVim中文用户**，VSCodeVim提供了[`im-select`](https://github.com/VSCodeVim/Vim/tree/c0225a2fd0ed25e36561ac64a362d0bdeec69156?tab=readme-ov-file#input-method)来进行中英输入法的自动切换。然而该方法需要两个键盘布局（中文和英文），每次中英文切换是通过切换键盘布局（和输入法）来实现的，而不是切换中文输入法内的中英文模式。

为了让VSCodeVim只切换中文输入法内的中英文模式而不去切换键盘布局（输入法），我编写了[`im-select-ch`](https://github.com/ybisland/im-select-ch/tree/main)用于替代原来的`im-select`，实现了只切换输入法的中英文模式。然而`im-select-ch`会导致在VSCodeVim切换模式时卡顿（包括原来的`im-select`也会造成卡顿）。

为了解决卡顿问题，我用VSCode插件重新实现了一遍`im-select-ch`，最终该插件解决了卡顿问题。


## Docs
https://code.visualstudio.com/api/working-with-extensions/publishing-extension