-- CreateTable
CREATE TABLE prisma_test.demo (
	id serial4 NOT NULL,
	"content" varchar(100) NOT NULL,
	complete bool DEFAULT false NOT NULL,
	created_at timestamptz(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	updated_at timestamptz(6) NOT NULL,
	CONSTRAINT demo_pkey PRIMARY KEY (id)
);
