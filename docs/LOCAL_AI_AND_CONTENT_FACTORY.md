# Локальный контур Дрёмы и контентная фабрика

Этот документ описывает то, что уже сделано, что проверено, а также границы следующего этапа.

## Репозитории

- `Takandrat-shop` хранит магазин и проектные навыки в `.agents/skills/`.
- `headlong` хранит локальную идентичность Дрёмы, её навыки и утилиты.
- Headlong не получает доступ к Supabase, заказам или данным покупателей.

## Что готово

### Навыки магазина

- `storefront` описывает каталог, корзину, checkout и ручную оплату.
- `product-image` описывает проверку фотографий и запрет на изменение товара.
- `product-video` описывает короткие видео, poster, fallback и reduced motion.
- `db-work` описывает миграции, RLS, резервные копии и проверку Supabase.
- `design-system` описывает визуальные правила магазина.
- `vercel-deploy` описывает публикацию и smoke checks.
- `catalog-ops` описывает поддержание правды каталога.
- `content-factory` объединяет подготовку фото, видео, текста и публикации.
- `context7` задаёт проверку актуальной документации перед использованием быстро меняющихся API.

### Дрёма и локальные модели

В Headlong добавлены:

- `skills/dreamthreads/SKILL.md` — бесплатный DreamThreads parser и правила интерпретации.
- `skills/seller-dreams/SKILL.md` — безопасный процесс seller dreams.
- `tools/seller-dreams` — генератор, review gate и подготовка кандидатов.
- `tools/gpt4all-local` — локальный GGUF adapter через установленный `llama-cpp-python`.
- `experiments/drema/events.sample.json` — обезличенные fixture events.

Найденные локальные модели:

- `LFM2-1.2B-Q4_0.gguf`
- `qwen2-1_5b-instruct-q4_0.gguf`

Путь GPT4All:

```text
$HOME/Library/Application Support/nomic.ai/GPT4All
```

## Как запустить seller-dreams

Для малого локального text model используйте text mode:

```bash
cd "/Users/kovganovaekaterirna/операционщик/headlong"

DREMA_OUTPUT=text \
DREMA_THREADS=2 \
DREMA_CTX=1024 \
DREMA_MAX_TOKENS=80 \
tools/seller-dreams generate \
  --events experiments/drema/events.sample.json \
  --out experiments/drema/run-lfm2-russian.json \
  --local-model \
  "$HOME/Library/Application Support/nomic.ai/GPT4All/LFM2-1.2B-Q4_0.gguf"
```

Посмотреть кандидата:

```bash
tools/seller-dreams review --input experiments/drema/run-lfm2-russian.json
```

Подтвердить вручную:

```bash
tools/seller-dreams review \
  --input experiments/drema/run-lfm2-russian.json \
  --decision approve \
  --note "Проверено владельцем" \
  --out experiments/drema/run-reviewed.json
```

Отклонить:

```bash
tools/seller-dreams review \
  --input experiments/drema/run-lfm2-russian.json \
  --decision reject \
  --note "Не использовать" \
  --out experiments/drema/run-rejected.json
```

Подготовить JSONL-кандидатов:

```bash
tools/seller-dreams curate \
  --input experiments/drema/run-reviewed.json \
  --out experiments/drema/qlora-candidates.jsonl
```

## Что проверено

Проверки, выполненные локально:

```bash
skills --dir "$PWD/skills" check seller-dreams
bash -n tools/seller-dreams
```

Результат проверки skill:

```text
OK bin jq
OK bin date
```

Полный локальный путь `generate → approve → curate` прошёл. В curated JSONL сохраняется:

```json
{"owner_label":"owner-approved","qlora_eligible":false}
```

## Что не сработало

### GPT4All API server

GPT4All Desktop установлен, но локальный OpenAI-compatible server не был включён. Порты `4891`, `4890`, `8080` и `11434` не ответили.

Поэтому выбран прямой локальный вызов GGUF через `llama-cpp-python`. Это не требует отдельного сервера и не делает сетевых запросов.

### Qwen JSON mode

`qwen2-1_5b-instruct-q4_0.gguf` иногда обрывал JSON на ограниченном контексте. Не используйте его сейчас для строгой автоматической схемы без отдельного теста.

### LFM2 JSON mode

`LFM2-1.2B-Q4_0.gguf` также может оборвать длинный JSON. Для него используется `DREMA_OUTPUT=text`, после чего runner сам создаёт безопасную структуру.

### Web search и Context7

Встроенный web search вернул ошибку аутентификации. Context7 skill добавлен, но MCP-сервер Context7 в конфигурацию не подключался и не имитировался.

При недоступном Context7 нужно сверять локальные типы, lockfile и официальную документацию пакета.

## Границы данных

- Не передавайте в модели имена, Telegram ID, телефоны, адреса, подтверждения оплаты или raw customer text.
- Не отправляйте в DreamThreads рабочие события. Если нужен parser, отправляйте только сам обезличенный dream text.
- Не превращайте dream в факт, диагноз, прогноз или обещание клиенту.
- Не записывайте dream автоматически в RAG.
- Не отправляйте цены, наличие, заказы и доставку в QLoRA.
- Не публикуйте контент без ручного approve.

## Оценка моделей

Текущие модели подходят для:

- классификации задач;
- извлечения фактов;
- поиска пропущенных полей;
- коротких черновиков;
- локальных рефлексий.

Они не подходят без проверки для:

- финальной русской брендовой копии;
- автоматической публикации;
- надёжного длинного JSON;
- генерации товарных изображений;
- товарного видео.

Перед поиском более мощной модели проверьте свободную память и Metal acceleration. Для текста разумный следующий диапазон — локальная модель 7–14B. Для фото и видео нужны отдельные image и video модели, которые должны работать от реального фото товара, а не создавать вымышленный товар.

## OpenRouter

OpenRouter можно добавить в магазин как отдельный облачный fallback после локального контура. Его нельзя включать как тихую замену локальной модели.

Для OpenRouter нужны:

- явный список разрешённых моделей;
- бюджет и лимит запросов;
- таймаут и retry policy;
- отсутствие customer PII в prompt;
- логирование только технических метрик;
- fallback на локальный или ручной режим;
- проверка актуальных model IDs, цен и лимитов по документации перед реализацией.

Ключ должен храниться в окружении или secret manager. Его нельзя коммитить в репозиторий.

## Следующий безопасный порядок

1. Подключить ручной review в интерфейсе, если он нужен владельцу.
2. Создать контентный brief для одного реального товара без customer data.
3. Проверить одну локальную text-модель на копирайтинге.
4. Отдельно сравнить разрешённые OpenRouter free models.
5. Подключить OpenRouter только после явного privacy и cost gate.
6. Добавить image pipeline от утверждённого product photo.
7. Добавить video pipeline с poster и still fallback.
8. Собрать минимум 50–100 исправленных и обезличенных примеров до обсуждения QLoRA.
