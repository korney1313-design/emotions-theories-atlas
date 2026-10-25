# Воспроизведение сравнения (#2)

Запускать из корня существующего Knowledge Atlas. Это пакет анализа, не отдельное приложение.
UI, авторские узлы, рёбра, статусы и веса не изменяются. Приватные лекционные файлы для повторного расчёта не нужны.

```bash
npm ci
python3 -m venv /tmp/atlas-comparison-env
/tmp/atlas-comparison-env/bin/pip install -r experiments/layout-comparison/requirements.txt
OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 /tmp/atlas-comparison-env/bin/python experiments/layout-comparison/compare.py --out /tmp/atlas-comparison-results
OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 /tmp/atlas-comparison-env/bin/python -m unittest discover -s experiments/layout-comparison -v
```

Точная среда расчёта: Python 3.14.4, версии пакетов в `requirements.txt`, версии Node/npm-пакетов — в `results/metadata.json`.
Закреплённые версии не обещают совместимости со всеми старыми Python. Тест `test_saved_experiment_contract` проверяет опубликованный комплект `results/`; геометрические тесты проверяют код анализа. Для проверки нового результата сравните JSON с опубликованным комплектом, кроме `elapsed_seconds` в metadata.

- `expert-reference.json`: неизменяемый предварительный эталон и протокол; коммит `877fabb` предшествует вычислениям. Автор — Codex, не приглашённый независимый эксперт.
- `compare.py`: Python-оркестратор, NetworkX KK 3D, метрики, Louvain, диагностический PNG.
- `d3-layouts.mjs`: настоящий d3-force-3d, A воспроизводит `src/model.js` с проверкой точного совпадения канонического seed.
- `results/coordinates.json`: 100 наборов координат, 48 узлов в каждом; A/B — объекты x/y/z, C — массивы [x,y,z].
- `results/metadata.json`: checksum входа, эталона, исходников, версии, seeds, все реальные возмущённые веса и параметры.
- `results/results.csv` / `.json`: каждая строка — алгоритм × seed × сценарий.
- `results/triplets.json`: все 1800 проверок эталона, включая неуспешные.
- `results/pair-diagnostics.json`: все 1128 пар каждого алгоритма для заранее выбранного seed 92481/base; знаковая ошибка, не «научная ошибка».
- `results/stability.json`: все сравнения после удаления сдвига/масштаба/вращения; зеркальное отражение допустимо.
- `results/communities.json`: членство и ARI/NMI каждого из 25 Louvain-запусков.
- `results/summary.json`: среднее/min/max пяти исходных seed, без смешивания с возмущениями.
- `qa/`: проверенные снимки существующего приложения без исходных заметок и журналы реально выполненных проверок.

Ни один экспериментальный режим не подключён к основному интерфейсу. Результаты и ограничения: [LAYOUT_COMPARISON.md](../../LAYOUT_COMPARISON.md).
