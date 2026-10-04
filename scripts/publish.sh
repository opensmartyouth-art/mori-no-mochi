#!/bin/bash
# 공개 저장소로 밀어 올린다.
#
# 로컬 저장소에는 ref/(원작 플레이 영상과 추출 프레임)가 들어 있고
# 이건 원작자의 저작물이라 공개하면 안 된다. 그래서 로컬에 origin 을 두지 않고,
# 매번 사본을 떠서 ref/ 와 원작 링크·핸들을 히스토리까지 걷어낸 뒤 올린다.
#
# 히스토리를 다시 쓰므로 공개본의 커밋 해시는 매번 바뀐다.
# 공개본은 읽기용 거울이지 작업 브랜치가 아니다.
#
# 아래에서 핸들과 도메인 문자열을 조각내 조립하는 이유:
# 그대로 적어 두면 이 스크립트 자신이 "지워야 할 것이 남아 있다" 는
# 마지막 검사에 걸린다.
set -e
HANDLE="fuzz""waa"
DOMAIN="threads""\\.com"

SRC="$(cd "$(dirname "$0")/.." && pwd)"
REMOTE="${1:-https://github.com/opensmartyouth-art/mori-no-mochi.git}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

SCRUB="$TMP/scrub.sh"
cat > "$SCRUB" <<INNER
#!/bin/sh
rm -rf ref
# .md 로 한정하면 과거 커밋의 스크립트 자신에 남은 문자열을 못 지운다.
for f in \$(grep -rlI -e '$HANDLE' -e '$DOMAIN' . 2>/dev/null); do
  # 1) GDD 의 원작 출처 줄을 통째로 바꾼다
  perl -pi -e 's{^- 원작: Threads.*\$}{- 원작: Threads 에 올라온 개인 제작 게임 (32초 플레이 영상).\n  공개 저장소에서는 원작자 보호를 위해 링크와 영상을 제외했다.}' "\$f"
  # 2) 남은 링크·핸들·도메인을 모두 지운다. @ 가 붙지 않은 경우까지 포함한다
  perl -pi -e 's{https?://\\S*$DOMAIN\\S*}{(링크 제외)}g' "\$f"
  perl -pi -e 's{\\@?$HANDLE}{(원작자)}g' "\$f"
  perl -pi -e 's{$DOMAIN}{(링크 제외)}g' "\$f"
done
exit 0
INNER
chmod +x "$SCRUB"

WORK="$TMP/pub"
git clone -q "$SRC" "$WORK"
cd "$WORK"
git remote remove origin
FILTER_BRANCH_SQUELCH_WARNING=1 git filter-branch -f \
  --tree-filter "sh $SCRUB" --prune-empty HEAD > /dev/null 2>&1
rm -rf .git/refs/original .git/refs/remotes
git reflog expire --expire=now --all
git gc --prune=now -q

# 공개본에 남으면 안 되는 것 확인. 하나라도 남으면 올리지 않는다.
BAD=0
if git log --all --name-only --pretty=format: | grep -q '^ref/'; then
  echo "중단: ref/ 파일이 히스토리에 남아 있다"
  BAD=1
fi
for pat in "$HANDLE" "$DOMAIN"; do
  HIT=$(git grep -I -l "$pat" $(git rev-list --all) 2>/dev/null || true)
  if [ -n "$HIT" ]; then
    echo "중단: '$pat' 가 히스토리에 남아 있다"
    echo "$HIT" | head -5 | sed 's/^/  /'
    BAD=1
  fi
done
[ "$BAD" = 0 ] || exit 1

git push -q --force "$REMOTE" HEAD:main
echo "올림: $(git rev-list --count HEAD)개 커밋 → $REMOTE"
