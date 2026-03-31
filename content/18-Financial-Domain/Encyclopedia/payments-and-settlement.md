---
type: reference
category: financial-encyclopedia
technology: []
tags: [financial]
aliases: [payments terms, settlement glossary, payment processing glossary, acquiring issuing glossary]
keywords: [acquiring, issuing, clearing, settlement, authorization, gateway, merchant services, payments processing, point-of-sale, tokenization, prepaid cards, virtual card, electronic money, fintech]
description: "Encyclopedia definitions for payments and settlement terms covering acquiring, issuing, clearing, settlement, authorization, gateway, merchant services, and payment processing drawn from the example Index universe."
related:
  - banking-and-lending
  - technology-and-digital
  - capital-markets-and-trading
created: 2026-03-22
updated: 2026-03-22
status: complete
---

# Payments and Settlement

Encyclopedia of payments and settlement terms covering the full transaction lifecycle from authorization through final settlement.

---

## Acquiring (Payments)

> [!quote]
> "Behind every card tap is a complex chain of trust that moves money from buyer to seller in seconds."
> — **Pieter van der Does**


**Definition:** In the payments industry, acquiring refers to the process by which a financial institution (called an acquirer or acquiring bank) processes credit or debit card transactions on behalf of a merchant. When a customer swipes, taps, or enters card details, the acquirer communicates with the card-issuing bank to authorize and settle the transaction. The acquirer takes on some of the risk that the merchant will fulfill its obligations and handles the flow of funds from the cardholder's bank to the merchant's account. Acquiring is one of the core pillars of any payment platform and is distinct from issuing, which deals with providing the card to the consumer.

**In context:** Adyen N.V. (ADYEN.AS, a European equity index) operates a payments platform whose "platform integrates payments stack, including gateway, risk management, processing, acquiring, and settlement services."

**Real-world example:** When you pay for a coffee with your debit card, the coffee shop's acquirer (e.g., Adyen or a traditional bank) receives the transaction request, routes it to your bank for approval, and then deposits the funds into the shop's business account, typically within one to two business days.

**Related terms:** [Gateway (Payments)](https://alp78.github.io/elysium/18-Financial-Domain/Encyclopedia/payments-and-settlement#Gateway%20(Payments)), [Settlement](https://alp78.github.io/elysium/18-Financial-Domain/Encyclopedia/payments-and-settlement#Settlement), [Issuing (Payments)](https://alp78.github.io/elysium/18-Financial-Domain/Encyclopedia/payments-and-settlement#Issuing%20(Payments)), [Authorization](https://alp78.github.io/elysium/18-Financial-Domain/Encyclopedia/payments-and-settlement#Authorization), [Merchant Services](https://alp78.github.io/elysium/18-Financial-Domain/Encyclopedia/payments-and-settlement#Merchant%20Services)

---

## Authorization

> [!quote]
> "Every payment starts with a question: can this person pay? The answer must come in milliseconds."
> — **Dan Schulman**


**Definition:** In the payments ecosystem, authorization is the process by which a card-issuing bank approves or declines a transaction initiated by a cardholder. When a consumer uses a credit or debit card, the merchant's payment terminal sends a request through the payment network to the issuing bank, which checks the cardholder's account for sufficient funds or available credit, verifies the card is not reported stolen, and applies fraud detection rules. The bank then sends back an approval or decline code. Authorization happens in real time, typically within seconds, and is one of the key steps in the payment processing chain.

**In context:** Adyen N.V. (ADYEN.AS, a European equity index) "provides a back-end infrastructure for authorizing" payments. Visa Inc. (V, a US equity index) operates "VisaNet, a transaction processing network that enables authorization, clearing, and settlement of payment transactions."

**Real-world example:** When you tap your credit card at a grocery store, the terminal sends a request to Visa's network, which forwards it to your bank. Your bank checks your credit limit, confirms the card is valid, and sends back an approval code — all within about two seconds. Only then does the terminal display "Approved."

**Related terms:** [Acquiring (Payments)](https://alp78.github.io/elysium/18-Financial-Domain/Encyclopedia/payments-and-settlement#Acquiring%20(Payments)), [Clearing](https://alp78.github.io/elysium/18-Financial-Domain/Encyclopedia/payments-and-settlement#Clearing), [Settlement](https://alp78.github.io/elysium/18-Financial-Domain/Encyclopedia/payments-and-settlement#Settlement), [Gateway (Payments)](https://alp78.github.io/elysium/18-Financial-Domain/Encyclopedia/payments-and-settlement#Gateway%20(Payments))

---

## Clearing

> [!quote]
> "The clearinghouse stands between buyer and seller so neither has to trust the other."
> — **Craig Pirrong**


**Definition:** Clearing is the process that occurs between the execution of a trade and the final settlement of that trade. A clearinghouse acts as an intermediary between the buyer and seller, ensuring that the trade obligations are properly fulfilled. The clearing process involves confirming trade details, calculating obligations, managing margins and collateral, and ultimately guaranteeing the performance of the trade. This process reduces counterparty risk — the risk that one party will fail to fulfill its side of the transaction — and is essential for the stability and integrity of financial markets.

**In context:** Hong Kong Exchanges and Clearing Limited (0388.HK, an Asia-Pacific equity index) "owns and operates stock and futures exchanges, and related clearing houses" providing "clearing, settlement and custodian" services. Deutsche Boerse (DB1.DE, a European equity index) offers "Eurex and European commodity clearing services" and operates "third clearing house Nodal Clear." Visa Inc. (V, a US equity index) operates a network that enables "authorization, clearing, and settlement."

**Real-world example:** When an investor in Hong Kong buys 1,000 shares of a company listed on the Hong Kong Stock Exchange, the Hong Kong Securities Clearing Company (a subsidiary of HKEX) steps in as the central counterparty, guaranteeing that the buyer receives the shares and the seller receives the payment.

**Related terms:** [Settlement](https://alp78.github.io/elysium/18-Financial-Domain/Encyclopedia/payments-and-settlement#Settlement), [Securities Clearing](https://alp78.github.io/elysium/18-Financial-Domain/Encyclopedia/payments-and-settlement#Securities%20Clearing), [Exchange (Stock/Futures)](https://alp78.github.io/elysium/18-Financial-Domain/Encyclopedia/capital-markets-and-trading#Exchange%20(Stock/Futures))

---

## Custodian Services

> [!quote]
> "The custody business is about trust — the trust that your assets will be there when you need them."
> — **Tim Keaney**


**Definition:** Custodian services involve the safekeeping and administration of financial assets such as stocks, bonds, and other securities on behalf of institutional and individual investors. A custodian bank holds these assets in electronic or physical form, processes transactions, collects dividends and interest payments, provides tax information, and handles corporate actions. Custodians do not engage in trading or advisory services; their role is to protect client assets and ensure accurate record-keeping. Custody is a critical function in the financial system, particularly for institutional investors managing billions of dollars.

**In context:** JPMorgan Chase (JPM, a US equity index) provides "custody, and securities products and services." Bank of America (BAC, a US equity index) offers "securities clearing, settlement, and custody services." Hong Kong Exchanges and Clearing (0388.HK, an Asia-Pacific equity index) provides "clearing, settlement and custodian, listing, depository, and nominee services."

**Real-world example:** A large pension fund holds USD 50 billion in global equities. A custodian bank safekeeps all these securities, processes dividend payments into the fund's account, provides daily portfolio valuations, handles corporate action notifications (such as stock splits), and generates year-end tax reporting.

**Related terms:** [Securities Clearing](https://alp78.github.io/elysium/18-Financial-Domain/Encyclopedia/payments-and-settlement#Securities%20Clearing), [Settlement](https://alp78.github.io/elysium/18-Financial-Domain/Encyclopedia/payments-and-settlement#Settlement)

---

## Electronic Money

> [!quote]
> "Money is just information, a way we measure what we trade, manage debts, make promises."
> — **David Graeber**, *Debt: The First 5,000 Years* (2011)


**Definition:** Electronic money (e-money) is a digital representation of monetary value stored electronically, used as a medium of exchange for transactions conducted through electronic devices. Unlike traditional bank deposits, e-money is prepaid and stored on cards, mobile devices, or online wallets. It facilitates cashless payments, online shopping, and person-to-person transfers. E-money systems reduce reliance on physical currency and are particularly important in markets with limited banking infrastructure.

**In context:** Seven & i Holdings (3382.T, an Asia-Pacific equity index) is "involved in...electronic money businesses" alongside its banking and credit card operations. Xiaomi Corporation (1810.HK, an Asia-Pacific equity index) provides "electronic payment technology" services.

**Real-world example:** A commuter in Tokyo loads JPY 5,000 onto a rechargeable transit card (like Suica). This stored value can be used to pay for train rides, vending machine purchases, and convenience store transactions by simply tapping the card — the balance decreases electronically with each use.

**Related terms:** [Digital Banking](https://alp78.github.io/elysium/18-Financial-Domain/Encyclopedia/banking-and-lending#Digital%20Banking), [Fintech](https://alp78.github.io/elysium/18-Financial-Domain/Encyclopedia/technology-and-digital#Fintech), [Payments Processing](https://alp78.github.io/elysium/18-Financial-Domain/Encyclopedia/payments-and-settlement#Payments%20Processing), [Prepaid Cards](https://alp78.github.io/elysium/18-Financial-Domain/Encyclopedia/payments-and-settlement#Prepaid%20Cards)

---

## Gateway (Payments)

> [!quote]
> "The payment gateway is the digital front door of every online business."
> — **Jack Dorsey**


**Definition:** A payment gateway is a technology service that authorizes and processes payments for online and in-store merchants. It serves as the intermediary between the merchant's point-of-sale system (or e-commerce website) and the payment networks (Visa, Mastercard, etc.). The gateway encrypts sensitive card data, transmits it to the acquiring bank and card network for authorization, and returns the approval or decline response to the merchant. Payment gateways are essential for enabling secure digital commerce and are a key component of the modern payments infrastructure.

**In context:** Adyen N.V. (ADYEN.AS, a European equity index) operates a platform that "integrates payments stack, including gateway, risk management, processing, acquiring, and settlement services." Mastercard (MA, a US equity index) provides "processing and gateway solutions."

**Real-world example:** When you buy a pair of shoes from an online store, the payment gateway encrypts your credit card number, sends it to the payment processor, receives authorization from your bank, and transmits the approval back to the store's website — all within seconds, enabling the store to confirm your order.

**Related terms:** [Acquiring (Payments)](https://alp78.github.io/elysium/18-Financial-Domain/Encyclopedia/payments-and-settlement#Acquiring%20(Payments)), [Payments Processing](https://alp78.github.io/elysium/18-Financial-Domain/Encyclopedia/payments-and-settlement#Payments%20Processing), [Authorization](https://alp78.github.io/elysium/18-Financial-Domain/Encyclopedia/payments-and-settlement#Authorization), [Merchant Services](https://alp78.github.io/elysium/18-Financial-Domain/Encyclopedia/payments-and-settlement#Merchant%20Services)

---

## Issuing (Payments)

> [!quote]
> "Putting a card in someone's hand is putting your brand in their wallet — and your risk on your balance sheet."
> — **Al Kelly**


**Definition:** In the payments industry, issuing refers to the process by which a financial institution (the issuer) provides payment cards (credit, debit, or prepaid) to consumers or businesses. The issuing bank establishes the cardholder's account, sets credit limits, processes billing and payments, manages rewards programs, and bears the credit risk for the cardholder's transactions. Issuing is the counterpart to acquiring in the payments ecosystem: the issuer represents the buyer's side while the acquirer represents the merchant's side of a transaction.

**In context:** Adyen N.V. (ADYEN.AS, a European equity index) offers "financial products, such as accounts, capital, issuing, and payouts." Mastercard (MA, a US equity index) provides "programs that enable issuers to provide consumers with credits to defer payments." Visa (V, a US equity index) offers "issuing solutions, such as airport lounge access, dining reservations."

**Real-world example:** A bank issues a Visa credit card to a consumer with a USD 10,000 credit limit. The bank manages the cardholder's account, sends monthly statements, collects payments, charges interest on outstanding balances, and earns interchange fees each time the cardholder uses the card for a purchase.

**Related terms:** [Acquiring (Payments)](https://alp78.github.io/elysium/18-Financial-Domain/Encyclopedia/payments-and-settlement#Acquiring%20(Payments)), [Credit Cards](https://alp78.github.io/elysium/18-Financial-Domain/Encyclopedia/banking-and-lending#Credit%20Cards), [Prepaid Cards](https://alp78.github.io/elysium/18-Financial-Domain/Encyclopedia/payments-and-settlement#Prepaid%20Cards), [Payments Processing](https://alp78.github.io/elysium/18-Financial-Domain/Encyclopedia/payments-and-settlement#Payments%20Processing)

---

## Merchant Services

> [!quote]
> "If you cannot accept a payment, you cannot make a sale."
> — **Max Levchin**


**Definition:** Merchant services encompass the financial services and technologies that enable businesses to accept and process electronic payment transactions, including credit and debit card payments, mobile payments, and online transactions. These services include payment processing, terminal leasing, fraud prevention, chargeback management, reporting and analytics, and settlement. Merchant service providers include banks, independent sales organizations, and fintech companies that help merchants of all sizes accept electronic payments.

**In context:** American Express (AXP, a US equity index) provides "merchant acquisition and processing, servicing and settlement, fraud prevention, and point-of-sale marketing and information products and services." National Australia Bank (NAB.AX, an Asia-Pacific equity index) offers "payments and merchant services."

**Real-world example:** A new restaurant signs up for merchant services with a payment processor, receiving a card terminal, access to an online payment portal for catering orders, and a dashboard for tracking daily sales. The processor charges 2.3% on each card transaction plus a monthly terminal fee.

**Related terms:** [Acquiring (Payments)](https://alp78.github.io/elysium/18-Financial-Domain/Encyclopedia/payments-and-settlement#Acquiring%20(Payments)), [Payments Processing](https://alp78.github.io/elysium/18-Financial-Domain/Encyclopedia/payments-and-settlement#Payments%20Processing), [Point-of-Sale](https://alp78.github.io/elysium/18-Financial-Domain/Encyclopedia/payments-and-settlement#Point-of-Sale), [Gateway (Payments)](https://alp78.github.io/elysium/18-Financial-Domain/Encyclopedia/payments-and-settlement#Gateway%20(Payments))

---

## Payments Processing

> [!quote]
> "Payments are to the economy what plumbing is to a building — invisible when working, catastrophic when not."
> — **Pieter van der Does**


**Definition:** Payments processing is the handling of financial transactions between merchants, consumers, and financial institutions through electronic systems. It encompasses the entire transaction lifecycle from initiation to final settlement, including authorization (verifying funds are available), authentication (confirming the identity of the payer), clearing (exchanging transaction details between parties), and settlement (transferring funds). Payment processors act as intermediaries in this chain, facilitating billions of transactions daily across credit cards, debit cards, mobile payments, and digital wallets.

**In context:** Adyen (ADYEN.AS, a European equity index) operates a platform that integrates "gateway, risk management, processing, acquiring, and settlement services." Mastercard (MA, a US equity index) provides "transaction processing and other payment-related products and services." Visa (V, a US equity index) operates "VisaNet, a transaction processing network." Walmart (WMT, a US equity index) "operates digital payment platforms."

**Real-world example:** When a customer taps their Mastercard at a retail store, the transaction passes through multiple steps in seconds: the terminal reads the card, the payment processor encrypts and routes the data, Mastercard's network directs it to the issuing bank for authorization, the bank approves or declines, and the response returns to the terminal. Settlement of funds to the merchant occurs within one to two business days.

**Related terms:** [Gateway (Payments)](https://alp78.github.io/elysium/18-Financial-Domain/Encyclopedia/payments-and-settlement#Gateway%20(Payments)), [Acquiring (Payments)](https://alp78.github.io/elysium/18-Financial-Domain/Encyclopedia/payments-and-settlement#Acquiring%20(Payments)), [Settlement](https://alp78.github.io/elysium/18-Financial-Domain/Encyclopedia/payments-and-settlement#Settlement), [Authorization](https://alp78.github.io/elysium/18-Financial-Domain/Encyclopedia/payments-and-settlement#Authorization), [Merchant Services](https://alp78.github.io/elysium/18-Financial-Domain/Encyclopedia/payments-and-settlement#Merchant%20Services)

---

## Point-of-Sale

> [!quote]
> "The checkout experience is where your brand makes its final impression — make it seamless."
> — **Angela Ahrendts**


**Definition:** Point-of-sale (POS) refers to the place and time where a retail transaction is completed. In physical stores, the POS is typically the checkout counter where the customer pays for purchases. A POS system includes hardware (terminal, card reader, receipt printer, cash drawer) and software that processes transactions, manages inventory, tracks sales data, and generates reports. Modern POS systems are integrated with payment processing networks, loyalty programs, and inventory management systems, providing real-time business intelligence to merchants.

**In context:** American Express (AXP, a US equity index) provides "point-of-sale marketing and information products and services." Adyen (ADYEN.AS, a European equity index) accepts payment through "in-person payments" at point-of-sale terminals.

**Real-world example:** A coffee shop uses a tablet-based POS system that accepts credit cards, debit cards, and mobile payments. When a customer taps their phone to pay, the POS system processes the payment, records the sale in the inventory system, deducts the sold items from stock, and updates the owner's real-time sales dashboard.

**Related terms:** [Merchant Services](https://alp78.github.io/elysium/18-Financial-Domain/Encyclopedia/payments-and-settlement#Merchant%20Services), [Payments Processing](https://alp78.github.io/elysium/18-Financial-Domain/Encyclopedia/payments-and-settlement#Payments%20Processing), [Acquiring (Payments)](https://alp78.github.io/elysium/18-Financial-Domain/Encyclopedia/payments-and-settlement#Acquiring%20(Payments))

---

## Prepaid Cards

> [!quote]
> "Prepaid cards are the great equalizer — they give everyone access to the electronic payments system."
> — **Steve Streit**


**Definition:** Prepaid cards are payment cards loaded with a set amount of money before use. Unlike credit cards (which extend credit) or debit cards (which draw from a bank account), prepaid cards draw from the pre-loaded balance. They are used for gift cards, payroll disbursement, travel money, and financial inclusion for unbanked populations. When the balance is exhausted, the cardholder must reload the card or acquire a new one.

**In context:** Adyen N.V. (ADYEN.AS, a European equity index) processes transactions for prepaid card products across its merchant base. Visa (V, a US equity index) and Mastercard (MA, a US equity index) both power prepaid card programs.

**Real-world example:** A parent loads USD 50 onto a Visa prepaid card for their teenager to use for school lunches. The card is accepted wherever Visa is accepted, but spending is limited to the preloaded balance, making it a controlled budgeting tool.

**Related terms:** [Issuing (Payments)](https://alp78.github.io/elysium/18-Financial-Domain/Encyclopedia/payments-and-settlement#Issuing%20(Payments)), [Electronic Money](https://alp78.github.io/elysium/18-Financial-Domain/Encyclopedia/payments-and-settlement#Electronic%20Money), [Credit Cards](https://alp78.github.io/elysium/18-Financial-Domain/Encyclopedia/banking-and-lending#Credit%20Cards)

---

## Securities Clearing

**Definition:** Securities clearing is the process of reconciling orders between transacting parties in the financial markets. It involves confirming the trade details, ensuring both parties have the securities and funds to complete the trade, and transferring the obligations through a central clearinghouse. Securities clearing reduces settlement risk by acting as the buyer to every seller and the seller to every buyer (central counterparty clearing). This netting process reduces the number of transactions that require settlement and the amount of securities and cash that must be exchanged.

**In context:** Bank of America (BAC, a US equity index) offers "securities clearing, settlement, and custody services." Hong Kong Exchanges and Clearing (0388.HK, an Asia-Pacific equity index) provides comprehensive "clearing, settlement and custodian" services.

**Real-world example:** On a given day, millions of stock trades occur on a major exchange. Instead of settling each trade individually, a clearinghouse nets all the buy and sell orders for each security. A broker that bought and sold the same stock multiple times may end up with a single net obligation, dramatically reducing the volume of actual securities and cash that must be transferred at settlement.

**Related terms:** [Clearing](https://alp78.github.io/elysium/18-Financial-Domain/Encyclopedia/payments-and-settlement#Clearing), [Settlement](https://alp78.github.io/elysium/18-Financial-Domain/Encyclopedia/payments-and-settlement#Settlement), [Custodian Services](https://alp78.github.io/elysium/18-Financial-Domain/Encyclopedia/payments-and-settlement#Custodian%20Services)

---

## Settlement

> [!quote]
> "Settlement is where the rubber meets the road — it is the moment when promises become reality."
> — **Benoît Coeuré**


**Definition:** Settlement is the final step in a securities or payment transaction, where the actual exchange of assets and cash occurs between parties. In securities trading, settlement involves the delivery of securities from the seller to the buyer and the transfer of payment from the buyer to the seller. Settlement periods vary by market and instrument type (T+1 or T+2, meaning one or two business days after the trade date). In payments, settlement is the transfer of funds from the acquiring bank to the merchant's account after a card transaction has been authorized and cleared.

**In context:** Adyen (ADYEN.AS, a European equity index) integrates "settlement services" into its payments platform. Visa (V, a US equity index) enables "authorization, clearing, and settlement of payment transactions." Hong Kong Exchanges and Clearing (0388.HK, an Asia-Pacific equity index) provides "clearing, settlement and custodian" services.

**Real-world example:** An investor buys 1,000 shares of Toyota on the Tokyo Stock Exchange on Monday. Under T+2 settlement, the actual transfer of shares to the investor's account and the debit of cash from the investor's account occurs on Wednesday. During this two-day window, the clearinghouse ensures both parties fulfill their obligations.

**Related terms:** [Clearing](https://alp78.github.io/elysium/18-Financial-Domain/Encyclopedia/payments-and-settlement#Clearing), [Payments Processing](https://alp78.github.io/elysium/18-Financial-Domain/Encyclopedia/payments-and-settlement#Payments%20Processing), [Custodian Services](https://alp78.github.io/elysium/18-Financial-Domain/Encyclopedia/payments-and-settlement#Custodian%20Services), [Authorization](https://alp78.github.io/elysium/18-Financial-Domain/Encyclopedia/payments-and-settlement#Authorization)

---

## Tokenization

> [!quote]
> "The best security is when the data worth stealing simply isn't there."
> — **Patrick Gauthier**


**Definition:** In the payments industry, tokenization is the process of replacing sensitive payment data (such as a credit card number) with a unique, non-sensitive equivalent called a token. The token retains the essential information needed to process the payment but cannot be used to access the original data if intercepted by unauthorized parties. Tokenization enhances payment security by ensuring that actual card numbers are never transmitted or stored by merchants, reducing the risk of data breaches and fraud.

**In context:** Visa (V, a US equity index) provides "tap to pay, tokenization, and click to pay services" as part of its payment technology offerings.

**Real-world example:** When you add your credit card to Apple Pay, the actual card number is never stored on your phone. Instead, a unique token is created and stored in the phone's secure element. When you tap your phone to pay at a store, the token is transmitted instead of your real card number, so even if the data is intercepted, it cannot be used for fraudulent transactions.

**Related terms:** [Payments Processing](https://alp78.github.io/elysium/18-Financial-Domain/Encyclopedia/payments-and-settlement#Payments%20Processing), [Cybersecurity](https://alp78.github.io/elysium/18-Financial-Domain/Encyclopedia/technology-and-digital#Cybersecurity), [Gateway (Payments)](https://alp78.github.io/elysium/18-Financial-Domain/Encyclopedia/payments-and-settlement#Gateway%20(Payments))

---

## Virtual Card Number

**Definition:** A virtual card number is a randomly generated, temporary card number linked to an existing credit or debit card account. It can be used for online purchases or specific vendor payments without exposing the actual card number. Virtual card numbers can be set with spending limits, expiration dates, and merchant restrictions, providing enhanced security and control. They are particularly useful for corporate expense management and procurement, where different virtual numbers can be assigned to different vendors or employees.

**In context:** Mastercard (MA, a US equity index) offers "Virtual Card Number, which is generated dynamically from an existing account and leverages the credit limit of the funding account" for business payments.

**Real-world example:** A company's accounts payable department generates a unique virtual card number with a USD 5,000 limit to pay a one-time office furniture supplier. After the payment is processed, the virtual number becomes inactive. Even if the supplier's systems are hacked, the stolen virtual number is useless because it has already expired and cannot be used for additional purchases.

**Related terms:** [Credit Cards](https://alp78.github.io/elysium/18-Financial-Domain/Encyclopedia/banking-and-lending#Credit%20Cards), [Payments Processing](https://alp78.github.io/elysium/18-Financial-Domain/Encyclopedia/payments-and-settlement#Payments%20Processing), [Tokenization](https://alp78.github.io/elysium/18-Financial-Domain/Encyclopedia/payments-and-settlement#Tokenization), [Cybersecurity](https://alp78.github.io/elysium/18-Financial-Domain/Encyclopedia/technology-and-digital#Cybersecurity)
