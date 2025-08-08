Set objShell = WScript.CreateObject("WScript.Shell")
objShell.Run "pwsh -WindowStyle Hidden -File ""C:\repos\jira-insights\JIRA insights.ps1""", 0, False
Set objShell = Nothing