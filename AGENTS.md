<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Git

Никогда не коммить самостоятельно. Не выполняй `git commit`, `git push`, `git reset`, `git rebase` и подобные операции, изменяющие историю или индекс, без явного запроса пользователя. Вноси правки в файлы и оставляй их незакоммиченными — пользователь сам решает, что и когда коммитить.

# Тесты

Сейчас идут плотные эксперименты с алгоритмами планирования — тесты пока не пишем. Не создавай `*.test.ts` файлы и не предлагай добавить покрытие, пока пользователь явно не попросит.

# Время и даты

При работе с датами, временем, календарными днями, timezone, кормлениями, весом, историей или днём жизни используй project skill `leon-time-conventions`.
