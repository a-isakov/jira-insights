<#
    Claude mini REST-wrapper (PowerShell 7, Windows-only)
    ----------------------------------------------------
    • listens on  http://localhost:<Port>/claude?prompt=&lang=&full=
    • builds long / short RU or EN prompt
    • starts console client  claude.exe  (located in Windows)
    • returns stdout back to the browser
    • CORS pre-flight (OPTIONS) is handled
    ----------------------------------------------------
    How to run
    powershell
        pwsh -File "C:\Claude\JIRA insights.ps1"          # port 7900
        pwsh -File "C:\Claude\JIRA insights.ps1" -Port 8000
    Then call from browser / fetch:
        http://localhost:7900/claude?prompt=HOR-512&lang=ru&full=false
    Place a shortcut with
        pwsh -WindowStyle Hidden -File "C:\Claude\JIRA insights.ps1"
    into shell:startup if you need it to start with Windows.
#>

param([int]$Port = 7900)          # HTTP port (change with -Port)

# Path or just name of the console client (must be in %PATH% or full path here)
$ClaudeExe  = 'C:\Users\AlexeyIsakov\AppData\Roaming\npm\claude.cmd'
$FixedArgs  = @('--print', '--dangerously-skip-permissions')   # CLI flags that never change

# ---------- build final prompt for Claude ----------
function Build-Prompt {
    param(
        [string]$TaskId,                       # value from ?prompt=
        [string]$Lang  = 'en',                 # ?lang=ru/en
        [string]$Full  = 'true'                # ?full=true/false
    )

    # Russian versions
    $ruFull = @"
Посмотри задачу JIRA номер $TaskId, изучи описание описание, комментарии и остальные поля.
Если в задаче есть привязанные Confluence статьи или есть ссылки на статьи в текстовых полях, посмотри их содержимое. Если прямых ссылок на статьи нет, искать их в Confluence по тексту не нужно.
Если в описании или в комментариях есть ссылки на Slack, прочитай переписки.
Поищи изменения в Gitlab ТОЛЬКО по номеру задачи.
Если у задачи есть Epic (доступен через поле parent), то проведи аналогичный анализ эпика.
Если у задачи есть прилинкованные задачи, проведи аналогичный анализ этих задач, учитывая тип связи.
В результате я хочу получить информацию по задаче: В чём суть задачи? Решение найдено? Какое сейчас состояние?
Не выводи значения стандартных полей задачи. Используй html форматирование для ответа, используя шрифты некрупного размера и с минимальным пустым местом между строками.
"@

    $ruShort = @"
Посмотри задачу JIRA номер $TaskId, изучи описание описание, комментарии и остальные поля.
Если у задачи есть Epic (доступен через поле parent), то проведи аналогичный анализ эпика.
Если у задачи есть прилинкованные задачи, проведи аналогичный анализ этих задач, учитывая тип связи.
В результате я хочу получить информацию по задаче: В чём суть задачи? Решение найдено? Какое сейчас состояние?
Не выводи значения стандартных полей задачи. Используй html форматирование для ответа, используя шрифты некрупного размера и с минимальным пустым местом между строками.
"@

    # English versions
    $enFull = @"
Look at JIRA task number $TaskId, read the description, comments and other fields.
If the task has linked Confluence articles or there are links to articles in text fields, check their content. If there are no direct links, don't search for them in Confluence.
If there are Slack links in the description or comments, read the conversations.
Search for GitLab changes by task number ONLY.
If the task has an Epic (available through the parent field), perform similar analysis of the epic.
If the task has linked tasks, perform similar analysis of these tasks, considering the link type.
As a result, I want to get information about the task: What is the essence of the task? Was a solution found? What is the current state?
Do not display standard task field values. Use HTML formatting of the answer using small fonts and minimal empty space between lines.
"@

    $enShort = @"
Look at JIRA task number $TaskId, read the description, comments and other fields.
If the task has an Epic (available through the parent field), perform similar analysis of the epic.
If the task has linked tasks, perform similar analysis of these tasks, considering the link type.
As a result, I want to get information about the task: What is the essence of the task? Was a solution found? What is the current state?
Do not display standard task field values. Use HTML formatting of the answer using small fonts and minimal empty space between lines.
"@

    switch ($Lang) {
        'ru' { if ($Full -eq 'true') { $ruFull } else { $ruShort } }
        default { if ($Full -eq 'true') { $enFull } else { $enShort } }
    }
}

# ---------- start HTTP listener ----------
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Claude server running on http://localhost:$Port/claude?prompt="

while ($listener.IsListening) {
    try {
        $ctx = $listener.GetContext()

        # ---------- CORS pre-flight ----------
        if ($ctx.Request.HttpMethod -eq 'OPTIONS') {
            $h = $ctx.Response.Headers
            $h['Access-Control-Allow-Origin' ] = '*'
            $h['Access-Control-Allow-Methods'] = 'GET, OPTIONS'
            $h['Access-Control-Allow-Headers'] = '*'
            $ctx.Response.StatusCode = 204      # No Content
            $ctx.Response.Close();  continue
        }

        # ---------- only /claude is accepted ----------
        if ($ctx.Request.Url.AbsolutePath -ne '/claude') {
            $ctx.Response.StatusCode = 404
            $ctx.Response.Close();  continue
        }

        # ---------- read query params ----------
        $qs     = $ctx.Request.QueryString
        $taskId = [System.Web.HttpUtility]::UrlDecode($qs['prompt'])
        if (-not $taskId) { $ctx.Response.StatusCode = 400; $ctx.Response.Close(); continue }

        $lang = ($qs['lang'] ? $qs['lang'] : 'en')
        $full = ($qs['full'] ? $qs['full'] : 'true')

        $prompt = Build-Prompt -TaskId $taskId -Lang $lang -Full $full
        
        # Display prompt in console
        Write-Host "`n[$(Get-Date -Format 'HH:mm:ss')] Processing request for: $taskId" -ForegroundColor Cyan
        Write-Host "Language: $lang | Full: $full" -ForegroundColor Gray
        Write-Host "Prompt:" -ForegroundColor Yellow
        Write-Host $prompt -ForegroundColor White
        Write-Host ("-" * 80) -ForegroundColor DarkGray

        # ---------- run Claude client ----------
        $psi = [System.Diagnostics.ProcessStartInfo]::new($ClaudeExe)
        foreach ($arg in ($FixedArgs + $prompt)) {
            $psi.ArgumentList.Add($arg)
        }
        $psi.RedirectStandardOutput = $true
        $psi.RedirectStandardError  = $true
        $psi.UseShellExecute        = $false
        $psi.StandardOutputEncoding = [System.Text.Encoding]::UTF8
        $psi.StandardErrorEncoding  = [System.Text.Encoding]::UTF8

        $proc = [System.Diagnostics.Process]::Start($psi)
        $out  = $proc.StandardOutput.ReadToEnd() + $proc.StandardError.ReadToEnd()
        $proc.WaitForExit()

        # ---------- send response ----------
        $bytes = [Text.Encoding]::UTF8.GetBytes($out)
        $resH  = $ctx.Response.Headers
        $resH['Access-Control-Allow-Origin'] = '*'
        $resH['Content-Type'] = 'text/plain; charset=utf-8'
        $ctx.Response.ContentLength64 = $bytes.Length
        $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
        $ctx.Response.Close()
    }
    catch { Write-Warning $_ }
}