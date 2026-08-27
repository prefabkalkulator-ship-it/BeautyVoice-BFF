const fs = require('fs');
let code = fs.readFileSync('src/app.ts', 'utf8');

const oldTagsLogic = `
      let whereClause: any = { tenantId: tenant.id };
      if (audience_tags) {
        const tagsArray = audience_tags.split(',').map((t: string) => t.trim());
        if (tagsArray.length > 0) {
           whereClause.tags = { hasSome: tagsArray };
        }
      }
`;

const newTagsLogic = `
      let whereClause: any = { tenantId: tenant.id };
      if (audience_tags) {
        const tagsArray = audience_tags.split(',').map((t: string) => t.trim());
        const normalTags = tagsArray.filter(t => t.toLowerCase() !== '#uśpieni' && t.toLowerCase() !== 'uśpieni');
        
        if (normalTags.length > 0) {
           whereClause.tags = { hasSome: normalTags };
        }
        
        if (tagsArray.some(t => t.toLowerCase() === '#uśpieni' || t.toLowerCase() === 'uśpieni')) {
           const ninetyDaysAgo = new Date();
           ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
           whereClause.OR = [
             { lastVisitAt: { lt: ninetyDaysAgo } },
             { lastVisitAt: null, createdAt: { lt: ninetyDaysAgo } }
           ];
        }
      }
`;

code = code.replace(oldTagsLogic, newTagsLogic);

// Add create_last_minute_offer
const lastMinuteLogic = `
    if (toolName === 'create_last_minute_offer') {
      const { campaign_name, audience_tags, message_content, target_datetime } = args;
      
      const campaign = await prisma.campaign.create({
        data: {
          tenantId: tenant.id,
          name: campaign_name || 'Last Minute Offer',
          type: 'sms',
          status: 'scheduled',
          messageContent: message_content,
        }
      });

      // Zarejestruj wirtualną rezerwację (Last minute slot)
      const targetDate = target_datetime ? new Date(target_datetime) : new Date();
      // Dodaj godzinę końca (+1h)
      const endDate = new Date(targetDate.getTime() + 60*60*1000);
      
      // Wybierzmy pierwszą usługę i pracownika (fallback)
      const service = await prisma.service.findFirst({ where: { tenantId: tenant.id } });
      const staff = await prisma.staffMember.findFirst({ where: { tenantId: tenant.id } });
      
      await prisma.appointment.create({
        data: {
          tenantId: tenant.id,
          serviceId: service ? service.id : '',
          staffId: staff ? staff.id : null,
          customerName: 'Last Minute Slot',
          customerPhone: 'SYSTEM',
          startTime: targetDate,
          endTime: endDate,
          status: 'last_minute_offer'
        }
      });

      let whereClause: any = { tenantId: tenant.id };
      if (audience_tags) {
        const tagsArray = audience_tags.split(',').map((t: string) => t.trim());
        const normalTags = tagsArray.filter(t => t.toLowerCase() !== '#uśpieni' && t.toLowerCase() !== 'uśpieni');
        
        if (normalTags.length > 0) {
           whereClause.tags = { hasSome: normalTags };
        }
        
        if (tagsArray.some(t => t.toLowerCase() === '#uśpieni' || t.toLowerCase() === 'uśpieni')) {
           const ninetyDaysAgo = new Date();
           ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
           whereClause.OR = [
             { lastVisitAt: { lt: ninetyDaysAgo } },
             { lastVisitAt: null, createdAt: { lt: ninetyDaysAgo } }
           ];
        }
      }

      const customers = await prisma.customer.findMany({ where: whereClause });

      for (const cust of customers) {
        if (!cust.phone) continue;
        await prisma.outboundQueue.create({
          data: {
            tenantId: tenant.id,
            targetPhone: cust.phone,
            channel: 'sms',
            payload: { customerId: cust.id, campaignId: campaign.id, text: message_content },
            status: 'pending',
            scheduledFor: new Date()
          }
        });
      }

      return res.json({ success: true, customersCount: customers.length, campaignId: campaign.id });
    }
`;

code = code.replace("if (toolName === 'schedule_confirmation_flow') {", lastMinuteLogic + "\n    if (toolName === 'schedule_confirmation_flow') {");

fs.writeFileSync('src/app.ts', code, 'utf8');
