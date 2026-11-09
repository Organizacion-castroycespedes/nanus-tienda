import { Inject, Injectable } from "@nestjs/common";
import { ControlCenterDatabaseService } from "../control-center-database.service";
import { addDays, parseIsoDate, todayInBogota } from "../shared/dates";

export const UPCOMING_DAYS = 15;

const AMOUNTS = `
  COALESCE(SUM(ch.total_amount - ch.paid_amount), 0)::text AS "openBalance",
  COALESCE(SUM(ch.total_amount - ch.paid_amount) FILTER (WHERE ch.due_date >= $1::date), 0)::text AS "notDue",
  COALESCE(SUM(ch.total_amount - ch.paid_amount) FILTER (WHERE ch.due_date < $1::date), 0)::text AS "overdue",
  COALESCE(SUM(ch.total_amount - ch.paid_amount) FILTER (WHERE $1::date - ch.due_date BETWEEN 1 AND 30), 0)::text AS "days1to30",
  COALESCE(SUM(ch.total_amount - ch.paid_amount) FILTER (WHERE $1::date - ch.due_date BETWEEN 31 AND 60), 0)::text AS "days31to60",
  COALESCE(SUM(ch.total_amount - ch.paid_amount) FILTER (WHERE $1::date - ch.due_date BETWEEN 61 AND 90), 0)::text AS "days61to90",
  COALESCE(SUM(ch.total_amount - ch.paid_amount) FILTER (WHERE $1::date - ch.due_date > 90), 0)::text AS "over90",
  COALESCE(SUM(ch.total_amount - ch.paid_amount) FILTER (WHERE ch.due_date BETWEEN $1::date AND $2::date), 0)::text AS "upcoming",
  COUNT(*) FILTER (WHERE ch.due_date < $1::date)::int AS "overdueCharges",
  MIN(ch.due_date) FILTER (WHERE ch.due_date < $1::date)::text AS "oldestDueDate"`;

@Injectable()
export class ReceivablesService {
  constructor(@Inject(ControlCenterDatabaseService) private readonly db: ControlCenterDatabaseService) {}

  /** Cartera a una fecha (hoy en Bogotá por defecto): saldos abiertos, tramos de mora, saldo a favor y próximos vencimientos. */
  async summary(query: Record<string, unknown>) {
    const asOf = query.asOf ? parseIsoDate(query.asOf, "asOf") : todayInBogota();
    const upcomingUntil = addDays(asOf, UPCOMING_DAYS);
    const open = `FROM control_center.charges ch WHERE ch.status IN ('OPEN', 'PARTIALLY_PAID')`;
    const [totals, credit, accounts, upcoming] = await Promise.all([
      this.db.query(`SELECT ${AMOUNTS} ${open}`, [asOf, upcomingUntil]),
      this.db.query(
        `SELECT COALESCE(SUM(amount - allocated_amount), 0)::text AS credit
         FROM control_center.receipts WHERE status = 'CONFIRMED'`,
      ),
      this.db.query(
        `WITH balances AS (
           SELECT ch.account_id, ${AMOUNTS} ${open} GROUP BY ch.account_id
         ), credits AS (
           SELECT account_id, SUM(amount - allocated_amount) AS credit
           FROM control_center.receipts WHERE status = 'CONFIRMED' AND amount > allocated_amount
           GROUP BY account_id
         )
         SELECT a.id AS "accountId", a.legal_name AS "legalName", a.tax_id_type AS "taxIdType", a.tax_id AS "taxId",
                COALESCE(b."openBalance", '0') AS "openBalance", COALESCE(b."notDue", '0') AS "notDue",
                COALESCE(b.overdue, '0') AS overdue, COALESCE(b."days1to30", '0') AS "days1to30",
                COALESCE(b."days31to60", '0') AS "days31to60", COALESCE(b."days61to90", '0') AS "days61to90",
                COALESCE(b."over90", '0') AS "over90", COALESCE(b.upcoming, '0') AS upcoming,
                COALESCE(b."overdueCharges", 0) AS "overdueCharges", b."oldestDueDate",
                COALESCE(cr.credit, 0)::text AS credit
         FROM control_center.commercial_accounts a
         LEFT JOIN balances b ON b.account_id = a.id
         LEFT JOIN credits cr ON cr.account_id = a.id
         WHERE b.account_id IS NOT NULL OR cr.account_id IS NOT NULL
         ORDER BY COALESCE(b.overdue::numeric, 0) DESC, COALESCE(b."openBalance"::numeric, 0) DESC, a.legal_name`,
        [asOf, upcomingUntil],
      ),
      this.db.query(
        `SELECT ch.id, ch.charge_number AS "chargeNumber", ch.due_date::text AS "dueDate",
                (ch.total_amount - ch.paid_amount)::text AS balance, ch.status, a.id AS "accountId", a.legal_name AS "accountLegalName",
                c.contract_number AS "contractNumber"
         FROM control_center.charges ch
         JOIN control_center.commercial_accounts a ON a.id = ch.account_id
         JOIN control_center.contracts c ON c.id = ch.contract_id
         WHERE ch.status IN ('OPEN', 'PARTIALLY_PAID') AND ch.due_date BETWEEN $1::date AND $2::date
         ORDER BY ch.due_date, ch.charge_number LIMIT 50`,
        [asOf, upcomingUntil],
      ),
    ]);
    return {
      asOf,
      upcomingUntil,
      totals: { ...totals.rows[0], credit: credit.rows[0]?.credit ?? "0" },
      accounts: accounts.rows,
      upcoming: upcoming.rows,
    };
  }
}
