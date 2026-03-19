-- Basic messy query
select
  id,
  name,
  email
from
  users
where
  id = 1
  and status = 'active'
  
  -- 
  
  
  2️⃣ Messy SELECT with functions
select  u.id ,coalesce(u.name,'unknown')name ,count(o.id)total_orders ,sum(o.price )total_spent from users u left join orders o on u.id=o.user_id where o.status='completed' group by u.id,u.name order by total_spent desc
-- 3️⃣ Nested functions
select id,coalesce(to_char(created_at,'DDMonYYYYHH24:MI:SS'),'N/A')created_time from users where created_at>now()-interval '7 days'
-- 4️⃣ JSON operations
select id,data->>'email'email,data->>'name'name from customers where data->>'status'='active'
-- 5️⃣ Window functions
select id,name,rank() over(partition by department order by salary desc)rank from employees
-- 6️⃣ Subquery
select id,name from users where id in(select user_id from orders where price>100)
-- 7️⃣ Complex joins (very messy)
select u.id,u.name,o.id order_id,o.total_price,p.name product_name from users u join orders o on u.id=o.user_id join order_items oi on o.id=oi.order_id join products p on oi.product_id=p.id where o.status='completed'
-- 8️⃣ CTE query
with recent_orders as(select user_id,sum(price)total from orders where created_at>now()-interval '30 days' group by user_id) select u.id,u.name,r.total from users u join recent_orders r on u.id=r.user_id
-- 9️⃣ PostgreSQL LATERAL query
select c.id,c.name,l.loan_amount from customers c left join lateral(select loan_amount from loans where customer_id=c.id order by created_at desc limit 1) l on true
-- 10️⃣ Large messy real-world style query
select c.unique_code,c.id customer_id,c.name,c.mobile_no,crm.role_id type,c.created_at,coalesce(to_char(ca.created_at,'DDMonYYYYHH24:MI:SS'),'N/A')recent_activity_time,coalesce(ca.activity_type,'N/A')recent_activity,coalesce(bl.total_amount,0)amount,coalesce(km.name,'New')current_stage from customers.customers c left join customers.customer_role_mapping crm on crm.customer_id=c.id left join lateral(select kyc_id from kyc.kyc_master_tracker where customer_id=c.id order by created_at desc limit 1) kmt on true left join kyc.kyc_master km on km.id=kmt.kyc_id left join lateral(select activity_type,created_at from transactions.customer_activities where customer_id=c.id order by created_at desc limit 1) ca on true left join lateral(select requested_amount total_amount from loans.borrower_loans where customer_id=c.id) bl on true where c.created_at between ? and ? order by c.created_at desc limit ? offset ?
-- 1️⃣1️⃣ Extremely broken SQL (for cleanup testing)
se lect id ,na me fro m users wh ere stat us='active'
-- 1️⃣2️⃣ SQL with multiple queries
select id,name from users where id=1;select id,price from orders where price>100
-- 1️⃣3️⃣ Aggregate query
select department,count(*) total_employees,avg(salary)avg_salary from employees group by department having avg(salary)>50000
-- 1️⃣4️⃣ CASE expression
select id,name,case when salary>100000 then 'high' when salary>50000 then 'medium' else 'low' end salary_level from employees
-- 1️⃣5️⃣ EXISTS query
select id,name from users u where exists(select 1 from orders o where o.user_id=u.id and o.status='pending')