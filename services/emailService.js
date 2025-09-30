const nodemailer = require('nodemailer');
const handlebars = require('handlebars');
const fs = require('fs');
const path = require('path');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: process.env.SMTP_PORT || 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    // Verify connection configuration
    this.transporter.verify((error, success) => {
      if (error) {
        console.log('SMTP configuration error:', error);
      } else {
        console.log('SMTP server is ready to take our messages');
      }
    });
  }

  // Load email template
  loadTemplate(templateName) {
    const templatePath = path.join(__dirname, 'templates', `${templateName}.hbs`);
    const templateSource = fs.readFileSync(templatePath, 'utf8');
    return handlebars.compile(templateSource);
  }

  // Send password reset email
  async sendPasswordResetEmail(userEmail, resetToken, userName) {
    try {
      const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
      
      const template = this.loadTemplate('passwordReset');
      const html = template({
        userName,
        resetUrl,
        expiryTime: '1 hour'
      });

      const mailOptions = {
        from: `"Cooperative Banking" <${process.env.SMTP_USER}>`,
        to: userEmail,
        subject: 'Password Reset Request - Cooperative Banking',
        html,
        text: `Hello ${userName},\n\nYou requested a password reset. Click the link below to reset your password:\n${resetUrl}\n\nThis link will expire in 1 hour.\n\nIf you didn't request this, please ignore this email.\n\nBest regards,\nCooperative Banking Team`
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('Password reset email sent:', result.messageId);
      return result;
    } catch (error) {
      console.error('Error sending password reset email:', error);
      throw error;
    }
  }

  // Send welcome email
  async sendWelcomeEmail(userEmail, userName, bankName) {
    try {
      const template = this.loadTemplate('welcome');
      const html = template({
        userName,
        bankName,
        loginUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`
      });

      const mailOptions = {
        from: `"Cooperative Banking" <${process.env.SMTP_USER}>`,
        to: userEmail,
        subject: `Welcome to ${bankName} - Cooperative Banking`,
        html,
        text: `Hello ${userName},\n\nWelcome to ${bankName}! Your account has been successfully created.\n\nYou can now log in to your account and start using our banking services.\n\nBest regards,\n${bankName} Team`
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('Welcome email sent:', result.messageId);
      return result;
    } catch (error) {
      console.error('Error sending welcome email:', error);
      throw error;
    }
  }

  // Send transaction notification
  async sendTransactionNotification(userEmail, userName, transactionDetails) {
    try {
      const template = this.loadTemplate('transactionNotification');
      const html = template({
        userName,
        transactionType: transactionDetails.type,
        amount: transactionDetails.amount,
        accountNumber: transactionDetails.accountNumber,
        balance: transactionDetails.balance,
        timestamp: transactionDetails.timestamp,
        description: transactionDetails.description
      });

      const mailOptions = {
        from: `"Cooperative Banking" <${process.env.SMTP_USER}>`,
        to: userEmail,
        subject: `Transaction Notification - ${transactionDetails.type.toUpperCase()}`,
        html,
        text: `Hello ${userName},\n\nA ${transactionDetails.type} transaction has been processed on your account ${transactionDetails.accountNumber}.\n\nAmount: ₹${transactionDetails.amount}\nBalance: ₹${transactionDetails.balance}\nTime: ${transactionDetails.timestamp}\nDescription: ${transactionDetails.description}\n\nIf you didn't perform this transaction, please contact us immediately.\n\nBest regards,\nCooperative Banking Team`
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('Transaction notification sent:', result.messageId);
      return result;
    } catch (error) {
      console.error('Error sending transaction notification:', error);
      throw error;
    }
  }

  // Send account statement
  async sendAccountStatement(userEmail, userName, statementData) {
    try {
      const template = this.loadTemplate('accountStatement');
      const html = template({
        userName,
        accountNumber: statementData.accountNumber,
        period: statementData.period,
        transactions: statementData.transactions,
        openingBalance: statementData.openingBalance,
        closingBalance: statementData.closingBalance
      });

      const mailOptions = {
        from: `"Cooperative Banking" <${process.env.SMTP_USER}>`,
        to: userEmail,
        subject: `Account Statement - ${statementData.accountNumber}`,
        html,
        attachments: statementData.pdfPath ? [{
          filename: `statement_${statementData.accountNumber}_${statementData.period}.pdf`,
          path: statementData.pdfPath
        }] : []
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('Account statement sent:', result.messageId);
      return result;
    } catch (error) {
      console.error('Error sending account statement:', error);
      throw error;
    }
  }
}

module.exports = new EmailService();
