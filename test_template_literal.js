// Test file for template literal SQL formatting

const query = `
	INSERT INTO loans.borrowers_loan_emis (
		loan_id,
		emi_number,
		due_date,
		total_amount,
		principal_amount,
		interest_amount,
		status,
		is_paid,
		paid_on,
		paid_amount,
		payment_mode,
		created_at,
		updated_at
	)
	VALUES (
		?,
		?,
		?,
		?,
		?,
		?,
		?,
		?,
		?,
		?,
		?,
		NOW(),
		NOW()
	)
`;

// Another test case
const selectQuery = `
	SELECT 
		u.id,
		u.name,
		u.email,
		COUNT(o.id) as order_count
	FROM users u
	LEFT JOIN orders o ON u.id = o.user_id
	WHERE u.status = 'active'
	GROUP BY u.id, u.name, u.email
	ORDER BY order_count DESC
	LIMIT 10
`;

// Test with UPDATE
const updateQuery = `
	UPDATE users 
	SET last_login = NOW(), 
		status = 'active' 
	WHERE id = ? 
	AND status != 'deleted'
`;

// Test with DELETE
const deleteQuery = `
	DELETE FROM sessions 
	WHERE created_at < NOW() - INTERVAL '30 days'
`;