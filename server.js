const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
const cors = require('cors');


dotenv.config();
const app = express();
app.use(cors());

app.use(express.json());

// Initialize Supabase client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// Create a referral
app.post('/api/referrals', async (req, res) => {
    const { referrerName, referrerEmail, refereeName, refereeEmail, course } = req.body;
    try {
        // Check if a referral already exists
        const { data: existingReferral, error: checkError } = await supabase
          .from('referrals')
          .select()
          .eq('referrer_email', referrerEmail)
          .eq('referee_email', refereeEmail)
          .eq('course', course)
          .single();
    
        if (checkError && checkError.code !== 'PGRST116') {
          // PGRST116 means no rows returned, which is fine
          throw checkError;
        }
    
        if (existingReferral) {
          return res.status(409).json({ error: 'This referral already exists' });
        }
    
        // If no existing referral, proceed with insertion
        const { data, error } = await supabase
          .from('referrals')
          .insert([
            { 
              referrer_name: referrerName, 
              referrer_email: referrerEmail, 
              referee_name: refereeName, 
              referee_email: refereeEmail, 
              course 
            }
          ]).select();;
    
        if (error) throw error;
    
        if (!data) {
          throw new Error('No data returned from Supabase insert');
        }
    
        console.log('Supabase insert response:', data);

    // Send email notification
    await sendReferralEmail(referrerName, referrerEmail, refereeName, refereeEmail, course);
    res.json({status:200, message: 'Referral submitted successfully', data: data[0] });
  } catch (error) {
    console.error('Error creating referral:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Function to send referral email
async function sendReferralEmail(referrerName, referrerEmail, refereeName, refereeEmail, course) {
  const transporter = nodemailer.createTransport({
    service: 'gmail', 
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  if (!refereeEmail) {
    throw new Error('Missing recipient email address');
  }
  console.log('Sending email to:', refereeEmail);
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: refereeEmail,
    subject: `${referrerName} has referred you to a course!`,
    text: `Hello ${refereeName},\n\n${referrerName} (${referrerEmail}) has referred you to the "${course}" course. Check it out!`,
  };

  const info = await transporter.sendMail(mailOptions);
  console.log('Email sent: ' + info.response);
      
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});