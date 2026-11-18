-- 只保留上海自然日下的聚合计数，不保存任何访客或答题明细。
CREATE TABLE usage_daily (
  day TEXT NOT NULL,
  event TEXT NOT NULL CHECK (event IN ('visit', 'test_start', 'test_finish', 'poster_generated', 'share_copied')),
  total INTEGER NOT NULL CHECK (total >= 0),
  PRIMARY KEY (day, event)
) WITHOUT ROWID;
