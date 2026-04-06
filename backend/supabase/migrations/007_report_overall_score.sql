-- Add overall performance score (x.x out of 10) to interview reports.
alter table interview_reports
  add column if not exists overall_score numeric(3,1);

do $$
begin
  alter table interview_reports
    add constraint interview_reports_overall_score_range
    check (overall_score is null or (overall_score >= 1.0 and overall_score <= 10.0));
exception
  when duplicate_object then null;
end $$;
