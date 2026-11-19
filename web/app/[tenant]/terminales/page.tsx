import { redirect } from "next/navigation";

const LegacyTerminalesRedirectPage = async ({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) => {
  const { tenant } = await params;

  redirect(`/${tenant}/config/terminals`);
};

export default LegacyTerminalesRedirectPage;
