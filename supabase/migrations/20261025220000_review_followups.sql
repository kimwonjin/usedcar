-- 종합 테스트 개선 제안 반영
-- 1) 딜러가 명의 이전 증빙을 제출하기 전에는 잘못 올린 사진을 지울 수 있다
-- 2) 감가 청구: 거래가 이상 금액 금지, 사진 1~6장 필수 (화면 규칙과 같게)
-- 3) 승인 딜러가 아니게 되면(정지·탈퇴) 진행 중 경매의 입찰을 거두고, 판매자 선택 후보에서도 뺀다

create policy "transfer-docs: dealer delete before submit" on storage.objects for delete to authenticated
  using (bucket_id = 'transfer-docs' and (storage.foldername(name))[1] = auth.uid()::text
    and exists (select 1 from public.deals d
                where d.id::text = (storage.foldername(name))[2] and d.dealer_id = auth.uid()
                  and d.transfer_submitted_at is null));

drop policy "claims: dealer submit" on public.depreciation_claims;
create policy "claims: dealer submit" on public.depreciation_claims for insert with check (
  dealer_id = auth.uid()
  and status = 'submitted'
  and cardinality(photo_paths) between 1 and 6
  and exists (select 1 from public.deals d
              where d.id = deal_id and d.dealer_id = auth.uid() and d.status = 'scheduled'
                and amount < d.agreed_price)
);

create or replace function public.withdraw_bids_on_dealer_suspend()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.status = 'approved' and new.status <> 'approved' then
    delete from public.bids b using public.auctions a
    where a.id = b.auction_id and b.dealer_id = new.id and a.status = 'live';
  end if;
  return new;
end;
$$;

create trigger dealers_withdraw_bids
  after update of status on public.dealers
  for each row execute function public.withdraw_bids_on_dealer_suspend();

revoke execute on function public.withdraw_bids_on_dealer_suspend() from public, anon, authenticated;

-- 판매 결정 대기 중인 경매에서도 승인 딜러의 입찰만 후보로 (accept_bid도 이 목록으로 검사한다)
create or replace function public.auction_top_bids(p_auction_id uuid)
returns table (bid_id uuid, amount bigint, dealer_id uuid, dealer_name text, dealer_rating numeric, completed_deals int)
language sql stable security definer set search_path = '' as $$
  select b.id, b.amount, d.id, d.business_name, d.rating,
         (select count(*)::int from public.deals x where x.dealer_id = d.id and x.status = 'completed')
  from public.bids b
  join public.dealers d on d.id = b.dealer_id
  join public.auctions a on a.id = b.auction_id
  where b.auction_id = p_auction_id
    and d.status = 'approved'
    and (a.seller_id = auth.uid() or public.is_admin())
  order by b.amount desc, b.created_at
  limit 3;
$$;
