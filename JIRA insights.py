# server.py
import asyncio, shlex
from fastapi import FastAPI, Query
from fastapi.responses import StreamingResponse, PlainTextResponse
from fastapi.middleware.cors import CORSMiddleware

#------------------------------------------
# uvicorn server:app --host 0.0.0.0 --port 7900 --timeout-keep-alive 36000     # foreground
# gunicorn -k uvicorn.workers.UvicornWorker server:app -b 0.0.0.0:7900 --timeout 36000  # background
#------------------------------------------

# ------------- configuration -------------
CLAUDE_BIN = "claude"     # or full path
EXTRA_OPTS = ["--print", "--dangerously-skip-permissions"]  # for non-interactive output and bypassing permission checks
# -----------------------------------------

app = FastAPI(title="Claude wrapper")

# Allow access from any localhost page
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
)

async def run_claude(prompt: str, lang: str, full: str):
    prompt_ru = ("Посмотри задачу JIRA номер " + prompt + ", изучи описание описание, комментарии и остальные поля. "
                 "Если в задаче есть привязанные Confluence статьи или есть ссылки на статьи в текстовых полях, посмотри их содержимое. Если прямых ссылок на статьи нет, искать их в Confluence по тексту не нужно. "
                 "Если в описании или в комментариях есть ссылки на Slack, прочитай переписки. "
                 "Поищи изменения в Gitlab ТОЛЬКО по номеру задачи. "
                 "Если у задачи есть Epic (доступен через поле parent), то проведи аналогичный анализ эпика. "
                 "Если у задачи есть прилинкованные задачи, проведи аналогичный анализ этих задач, учитывая тип связи. "
                 "В результате я хочу получить информацию по задаче: В чём суть задачи? Решение найдено? Какое сейчас состояние? "
                 "Не выводи значения стандартных полей задачи. Используй html форматирование для ответа, используя шрифты некрупного размера и с минимальным пустым местом между строками.")
    prompt_ru_short = ("Посмотри задачу JIRA номер " + prompt + ", изучи описание описание, комментарии и остальные поля. "
                 "Если у задачи есть Epic (доступен через поле parent), то проведи аналогичный анализ эпика. "
                 "Если у задачи есть прилинкованные задачи, проведи аналогичный анализ этих задач, учитывая тип связи. "
                 "В результате я хочу получить информацию по задаче: В чём суть задачи? Решение найдено? Какое сейчас состояние? "
                 "Не выводи значения стандартных полей задачи. Используй html форматирование для ответа, используя шрифты некрупного размера и с минимальным пустым местом между строками.")
    prompt_en = ("Look at JIRA task number " + prompt + ", read the description, comments and other fields. "
                 "If the task has linked Confluence articles or there are links to articles in text fields, check their content. If there are no direct links, don't search for them in Confluence. "
                 "If there are Slack links in the description or comments, read the conversations. "
                 "Search for GitLab changes by task number ONLY. "
                 "If the task has an Epic (available through the parent field), perform similar analysis of the epic. "
                 "If the task has linked tasks, perform similar analysis of these tasks, considering the link type. "
                 "As a result, I want to get information about the task: What is the essence of the task? Was a solution found? What is the current state? "
                 "Do not display standard task field values. Use HTML formatting of the answer using small fonts and minimal empty space between lines.")
    prompt_en_short = ("Look at JIRA task number " + prompt + ", read the description, comments and other fields. "
                 "If the task has an Epic (available through the parent field), perform similar analysis of the epic. "
                 "If the task has linked tasks, perform similar analysis of these tasks, considering the link type. "
                 "As a result, I want to get information about the task: What is the essence of the task? Was a solution found? What is the current state? "
                 "Do not display standard task field values. Use HTML formatting of the answer using small fonts and minimal empty space between lines.")

    if (lang == "ru"):
        if (full == "true"):
            prompt = prompt_ru
        else:
            prompt = prompt_ru_short
    else:
        if (full == "true"):
            prompt = prompt_en
        else:
            prompt = prompt_en_short

    print(prompt)

    cmd = [CLAUDE_BIN, *EXTRA_OPTS, prompt]
    proc = await asyncio.create_subprocess_exec(
        *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT
    )
    # Output stdout line by line so browser sees the stream
    async for line in proc.stdout:
        yield line.decode('utf-8')
    await proc.wait()

@app.get("/claude")
async def call_claude(prompt: str = Query(..., description="Submit any request"), lang: str = Query("en", description="Language for response (ru/en)"), full: str = Query("true", description="Do deep research (true/false)")):
    return StreamingResponse(run_claude(prompt, lang, full), media_type="text/plain", headers={"X-Accel-Buffering": "no"})