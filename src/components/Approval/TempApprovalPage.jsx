// src/components/Approval/TempApprovalPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import { getApprovalTempList, deleteTempApprovals } from "../motiveOn/api";

/** =========================================================
 *  TempApprovalPage (모바일 임시 문서함)
 *  - 서버 데이터만 사용 (더미 제거)
 *  - 카드 내부 리스트만 스크롤
 *  - 체크박스로 다중 선택 삭제
 *  - headerOffset: 상단 고정 헤더 높이(px) (기본 56)
 * ========================================================= */
export default function TempApprovalPage({
  headerOffset = 56,
  onDeleteSelected, // 있으면 그걸 사용, 없으면 기본 서버삭제 사용
}) {
  const [data, setData] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [field, setField] = useState("title");   // title | form | drafter
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState("");

  // 응답 키 정규화 (대문자/스네이크 → UI 표준)
  const normalizeRow = (r = {}) => {
    const pick = (...keys) => keys.find((k) => r[k] !== undefined);
    return {
      signNo:     r[pick("signNo","SIGNNO","signno","SIGN_NO")] ?? r.signNo,
      title:      r[pick("title","TITLE")] ?? "",
      formName:   r[pick("formName","FORMNAME","form_name")] ?? r[pick("formNo","FORMNO","SFORMNO")] ?? "",
      formNo:     r[pick("formNo","FORMNO","SFORMNO")] ?? "",
      draftAt:    r[pick("draftAt","DRAFTAT","ddate","DDATE","REGDATE")] ?? null,
      completeAt: r[pick("completeAt","COMPLETEAT","edate","EDATE","COMPLETE_AT")] ?? null,
      emergency:  Number(r[pick("emergency","EMERGENCY")]) || 0,
      docStatus:  Number(r[pick("docStatus","DOCSTATUS","STATE")]) || 0,
      drafterName: r[pick("drafterName","DRAFTERNAME","drafter_name","DRAFTER_NAME")] ?? "",
    };
  };

  // 로드 함수 (재시도 버튼에서도 사용)
  const load = async () => {
    try {
      setLoading(true);
      setErrMsg("");
      const res = await getApprovalTempList({ page: 1, size: 50 });
      const ct = (res?.headers?.["content-type"] || "").toLowerCase();
      if (!ct.includes("application/json")) throw new Error("JSON이 아닌 응답");

      const raw = Array.isArray(res?.data?.content)
        ? res.data.content
        : Array.isArray(res?.data?.list)
        ? res.data.list
        : [];

      const list = raw.map(normalizeRow);
      setData(list);
    } catch (e) {
      console.error("[TempApprovalPage] load fail:", e);
      setErrMsg("목록을 불러오지 못했습니다.");
      setData([]); // 더미 없이 빈 배열
    } finally {
      setLoading(false);
    }
  };

  // 최초 로드
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const kw = (keyword || "").trim().toLowerCase();
    return (data || []).filter((r) => {
      let val = "";
      if (field === "title") val = r.title || "";
      else if (field === "form") val = r.formName || r.formNo || "";
      else if (field === "drafter") val = r.drafterName || "";
      if (!kw) return true;
      return String(val).toLowerCase().includes(kw);
    });
  }, [data, field, keyword]);

  const allIdsOnScreen = filtered.map((r) => r.signNo);
  const allCheckedOnScreen =
    allIdsOnScreen.length > 0 && allIdsOnScreen.every((id) => selected.has(id));

  const toggleOne = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAllOnScreen = (checked) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) allIdsOnScreen.forEach((id) => next.add(id));
      else allIdsOnScreen.forEach((id) => next.delete(id));
      return next;
    });
  };

  const handleDelete = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return alert("삭제할 문서를 선택하세요.");
    if (!confirm(`선택한 ${ids.length}건을 삭제하시겠습니까?`)) return;

    try {
      if (onDeleteSelected) {
        await onDeleteSelected(ids);
      } else {
        // 기본 서버 삭제 호출 (컨트롤러: /api/approval/temp/delete.json)
        const res = await deleteTempApprovals(ids);
        if (res?.data?.ok === false) throw new Error(res.data.message || "삭제 실패");
      }
      // 프론트 목록에서도 제거
      setData((prev) => prev.filter((r) => !selected.has(r.signNo)));
      setSelected(new Set());
    } catch (e) {
      console.error(e);
      alert("삭제 중 오류가 발생했습니다.");
    }
  };

  return (
    <Wrapper style={{ top: headerOffset }}>
      <Frame>
        <PageHeader>임시 문서함</PageHeader>

        <Content>
          <Section>
            <Card>
              <CardHeader>
                임시 보관함
                <BtnDelete
                  type="button"
                  onClick={handleDelete}
                  disabled={selected.size === 0}
                  aria-label="선택 삭제"
                >
                  🗑 삭제{selected.size > 0 ? ` (${selected.size})` : ""}
                </BtnDelete>
              </CardHeader>

              <CardBody>
                <HeaderRow>
                  <MasterSelect>
                    <input
                      id="masterCheck"
                      type="checkbox"
                      checked={allCheckedOnScreen}
                      onChange={(e) => toggleAllOnScreen(e.target.checked)}
                    />
                    <label htmlFor="masterCheck">전체선택</label>
                  </MasterSelect>

                  <SearchBar>
                    <Select value={field} onChange={(e) => setField(e.target.value)}>
                      <option value="title">제목</option>
                      <option value="form">결재양식</option>
                      <option value="drafter">기안자</option>
                    </Select>
                    <Input
                      value={keyword}
                      placeholder="검색어를 입력하세요."
                      onChange={(e) => setKeyword(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                    />
                    <SearchBtn
                      type="button"
                      title="검색"
                      onClick={() => {/* 서버 검색 필요 시 쿼리 파라미터 붙여서 재호출 */}}
                    >
                      🔎
                    </SearchBtn>
                  </SearchBar>
                </HeaderRow>

                {/* 카드 내부만 세로 스크롤 */}
                <ScrollArea>
                  {loading ? (
                    <Empty>불러오는 중…</Empty>
                  ) : errMsg ? (
                    <Empty>
                      {errMsg}{" "}
                      <Retry type="button" onClick={load}>다시 시도</Retry>
                    </Empty>
                  ) : filtered.length === 0 ? (
                    <Empty>표시할 문서가 없습니다.</Empty>
                  ) : (
                    <MobileList>
                      {filtered.map((row) => (
                        <TempDocCard
                          key={row.signNo}
                          row={row}
                          checked={selected.has(row.signNo)}
                          onToggle={() => toggleOne(row.signNo)}
                        />
                      ))}
                    </MobileList>
                  )}
                </ScrollArea>
              </CardBody>
            </Card>
          </Section>
        </Content>
      </Frame>
    </Wrapper>
  );
}

/* ===================== Item Card ===================== */
function TempDocCard({ row, checked, onToggle }) {
  const navigate = useNavigate();
  const lastDate = row.completeAt || row.draftAt;

  return (
    <CardItem>
      {/* 1행: 제목 + 체크박스 */}
      <div className="titleRow">
        <div className="titleLeft">
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); navigate(`/approval/detail/${row.signNo}`); }}
            className="title"
            title={row.title}
            style={{ color: "inherit", textDecoration: "none" }}
          >
            {row.title}
          </a>
        </div>

        <div className="right">
          <CheckWrap>
            <input id={`ck-${row.signNo}`} type="checkbox" checked={checked} onChange={onToggle} />
            <label htmlFor={`ck-${row.signNo}`} />
          </CheckWrap>
        </div>
      </div>

      {/* 2행: 양식이름 | 날짜(~ yyyy.MM.dd) */}
      <div className="sub">
        <span>{row.formName ?? row.formNo}</span>
        <span className="date">{formatDotDate(lastDate)}</span>
      </div>
    </CardItem>
  );
}

/* ===================== helpers ===================== */
function formatDateLike(value) {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(+d)) return String(value);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
function formatDotDate(value) {
  const s = formatDateLike(value);
  return s ? `~ ${s.replaceAll("-", ".")}` : "";
}

/* ===================== styled ===================== */
/* 페이지 전체를 헤더 아래에 고정해서 외부 스크롤 제거 */
const Wrapper = styled.div`
  position: fixed;
  left: 0; right: 0; bottom: 0;
  /* top은 props로 주입: headerOffset */
  background: #fff;
  display: grid;
  place-items: center;
  overflow: hidden;
  z-index: 0;
`;

const Frame = styled.div`
  width: 100%;
  max-width: 420px;
  height: 100%;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
`;

const PageHeader = styled.header`
  flex: 0 0 auto;
  background: #fff;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  padding: 12px 16px;
  font-size: 18px;
  font-weight: 700;
`;

const Content = styled.div`
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
`;

const Section = styled.section`
  height: 90%;
  padding: 8px 0;
  &:last-of-type { padding-bottom: 0; }
  min-height: 0;
`;

const Card = styled.div`
  height: 100%;
  border: 1px solid #e6eaf0;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);
  margin: 0 8px;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden; /* 스크롤바를 카드 라운드 안쪽으로 */
`;

const CardHeader = styled.div`
  position: relative;
  flex: 0 0 auto;
  padding: 8px 12px;
  font-weight: 700;
  font-size: 14px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
`;

const BtnDelete = styled.button`
  position: absolute; right: 10px; top: 6px;
  height: 25px; padding: 0 10px;
  border-radius: 8px; border: 1px solid #e5e7eb;
  background: ${({ disabled }) => (disabled ? "#f5f5f5" : "#fff")};
  color: ${({ disabled }) => (disabled ? "#a1a1a1" : "#d12b2b")};
  font-weight: 700;
`;

const CardBody = styled.div`
  flex: 1 1 auto;
  min-height: 0;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

/* 리스트만 세로 스크롤 */
const ScrollArea = styled.div`
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;

  scrollbar-gutter: stable;
  scrollbar-width: thin;
  scrollbar-color: rgba(0,0,0,.25) transparent;

  &::-webkit-scrollbar { width: 8px; }
  &::-webkit-scrollbar-track { background: transparent; }
  &::-webkit-scrollbar-thumb {
    background: rgba(0,0,0,.22);
    border-radius: 8px;
    border: 2px solid transparent;
    background-clip: content-box;
  }
`;

const HeaderRow = styled.div`
  flex: 0 0 auto;
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  min-width: 0;
`;

const MasterSelect = styled.div`
  display: inline-flex; align-items: center; gap: 8px;
  input[type="checkbox"]{ width: 18px; height: 18px; }
  label{ font-size: 13px; color: #4b5563; }
`;

const SearchBar = styled.div`
  display: flex;
  gap: 6px;
  align-items: center;
  width: 100%;
  max-width: 420px;
  min-width: 0;
`;
const Select = styled.select`
  height: 36px; font-size: 14px; padding: 0 8px; flex: 0 0 110px;
  border: 1px solid #e5e7eb; border-radius: 8px; background: #fff;
`;
const Input = styled.input`
  height: 36px; font-size: 14px; padding: 0 10px; flex: 1 1 auto;
  border: 1px solid #e5e7eb; border-radius: 8px; min-width: 0;
`;
const SearchBtn = styled.button`
  height: 36px; padding: 0 10px; border: none; border-radius: 8px;
  background: #2C3E50; color: #fff; cursor: pointer;
`;

const MobileList = styled.ul`
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0 0 6px;
  list-style: none;
  overflow-x: hidden;
`;

const CardItem = styled.li`
  border: 1px solid #e6eaf0;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(16,24,40,.04);
  padding: 10px 12px;
  display: grid;
  grid-template-columns: 1fr auto;
  row-gap: 4px;
  column-gap: 6px;
  min-width: 0;

  .titleRow {
    grid-column: 1 / span 2;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-width: 0;
  }
  .titleLeft { display: flex; align-items: center; gap: 8px; min-width: 0; }
  .title {
    font-weight: 700; font-size: 15px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .right { justify-self: end; }

  .sub {
    grid-column: 1 / span 2; display: flex; gap: 10px;
    font-size: 12px; color: #6B7280;
    min-width: 0; overflow: hidden;
  }
  .date { margin-left: auto; font-size: 12px; color: #6B7280; }
`;

/* 체크박스(상태 자리) */
const CheckWrap = styled.span`
  input { display: none; }
  label {
    width: 22px; height: 22px; border-radius: 6px;
    display: inline-block; border: 2px solid #c7ccd6; background: #fff;
    position: relative; cursor: pointer;
  }
  input:checked + label {
    background: #3A8DFE; border-color: #3A8DFE;
  }
  input:checked + label::after{
    content:""; position:absolute; left:6px; top:2px;
    width:6px; height:12px; border:2px solid #fff;
    border-left:0; border-top:0; transform: rotate(45deg);
  }
`;

const Empty = styled.div`
  color: #95A1AF;
  text-align: center;
  padding: 28px 0;
  font-size: 13px;
`;

const Retry = styled.button`
  margin-left: 8px;
  padding: 4px 8px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
`;