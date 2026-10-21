**Computer science THESIS**

+--------------------------------+-------------+------------------------------------------------------------------------------------------------------------------+---------------------------+------------------------------------+---+
| I.  **Research Title:**        |             | **RideShareEU: A Priority-Scored Greedy Matching Algorithm for Optimizing Schedule-Based University Carpooling** |                           |                                    |   |
+================================+=============+==================================================================================================================+===========================+====================================+===+
| II. **Profile of Researchers** |             |                                                                                                                  | :                         |                                    |   |
+--------------------------------+-------------+------------------------------------------------------------------------------------------------------------------+---------------------------+------------------------------------+---+
| **Name of Researchers**        |             | :                                                                                                                | De Asis, Von Altair R.    |                                    |   |
+--------------------------------+-------------+------------------------------------------------------------------------------------------------------------------+---------------------------+------------------------------------+---+
|                                |             |                                                                                                                  | Dimacali, Xyrus Lorenz M. |                                    |   |
+--------------------------------+-------------+------------------------------------------------------------------------------------------------------------------+---------------------------+------------------------------------+---+
|                                |             |                                                                                                                  | Sayat, Nash Adriane D.    |                                    |   |
+--------------------------------+-------------+------------------------------------------------------------------------------------------------------------------+---------------------------+------------------------------------+---+
| **Degree**                     |             | :                                                                                                                | BS in Computer Science    |                                    |   |
+--------------------------------+-------------+------------------------------------------------------------------------------------------------------------------+---------------------------+------------------------------------+---+
| **Specialization**             |             | :                                                                                                                | Software Engineering      |                                    |   |
+--------------------------------+-------------+------------------------------------------------------------------------------------------------------------------+---------------------------+------------------------------------+---+
| **Name of Research Adviser**   |             | :                                                                                                                | Jhon Rover Sinag          |                                    |   |
+--------------------------------+-------------+------------------------------------------------------------------------------------------------------------------+---------------------------+------------------------------------+---+

III. **Manuscript Content**

**Platform/s Thematic Areas** (Based on MSEUF Research Agenda 2019 -- 2030)

*Check applicable boxes:*

> ☒ **Technology, Engineering, and Industry 4.0 Research**
>
> ☐ Environmental Protection, Development, and Conservation Research
>
> ☐ Business, Economics and Industry 4.0 Research
>
> ☐ Politics, Society, and Culture Research
>
> ☐ Legal, Law Enforcement, and Criminology Research
>
> ☐ Health Research, Development, Innovation, and Extension
>
> ☐ Education 4.0 and Workforce 4.0 Research

**Sustainable Development Goals (SDGs)**

(*Depending on the platform, you may check more than one SDG*)

> ☐ SDG 1. End poverty in all its forms everywhere.
>
> ☐ SDG 2. End hunger, achieve food security and improved nutrition and promote sustainable agriculture.
>
> ☐ SDG 3. Ensure healthy lives and promote well-being for all at all ages.
>
> ☐ SDG 4. Ensure inclusive and equitable quality education and promote lifelong learning opportunities for all.
>
> ☐ SDG 5. Achieve gender equality and empower all women and girls
>
> ☐ SDG 6. Ensure availability and sustainable management of water and sanitation for all.
>
> ☐ SDG 7. Ensure access to affordable, reliable, sustainable & modern energy for all
>
> ☐ SDG 8. Promote sustained, inclusive and sustainable economic growth, full and productive employment and decent work for all.
>
> ☒ SDG 9. Build resilient infrastructure, promote inclusive and sustainable industrialization and foster innovation.
>
> ☐ SDG 10. Reduce inequality within and among countries.
>
> ☒ SDG 11. Make cities and human settlements inclusive, safe, resilient and sustainable.
>
> ☐ SDG 12. Ensure sustainable consumption and production patterns.
>
> ☒ SDG 13. Take urgent action to combat climate change and its impacts.
>
> ☐ SDG 14. Conserve and sustainably use the oceans, seas and marine resources for sustainable development.
>
> ☐ SDG 15. Protect restore and promote sustainable use of terrestrial ecosystems, sustainably manage forests, combat desertification and reverse land degradation and halt biodiversity loss.
>
> ☐ SDG 16. Promote peaceful and inclusive societies for sustainable development, provide access to justice for all and build effective, accountable and inclusive institutions at all levels.

**\
**

**RideShareEU: A Priority-Scored Greedy Matching Algorithm for Optimizing Schedule-Based University Carpooling**

A Computer Science Thesis

Presented to the Faculty of the

College of Computing and Multimedia Studies

Manuel S. Enverga University Foundation University

Lucena City

In Partial Fulfillment

of the Requirements for the Degree

Bachelor of Science in Computer Science

By

De Asis, Von Altair R.

Dimacali, Xyrus Lorenz M.

Sayat, Nash Adriane D.

MAY 2026

# Approval Sheet {#approval-sheet .unnumbered}

This capstone project study hereto entitled:

**"RideShareEU: A Priority-Scored Greedy Matching Algorithm for Optimizing Schedule-Based University Carpooling"**

prepared and submitted by **De Asis, Von Altair R., Dimacali, Xyrus Lorenz M., Sayat, Nash Adriane D.,** in partial fulfillment of the requirements for the degree **Bachelor of Science in Computer Science** has been examined and is recommended for acceptance and approval.

**Jhon Rover Sinag**

> Adviser

Approved by the committee on Oral Examination with a grade of \_\_\_\_\_\_\_\_\_.

\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

Chairman

Dean Rodrigo C. Belleza, Jr.

Member

Engr. Roselyn A. Maaño

Member

Accepted and approved in partial fulfillment of the requirements for the degree Bachelor of Science in Computer Science.

**Dean Rodrigo C. Belleza, Jr.**

College of Computing and Multimedia Studies

# Acknowledgement {#acknowledgement .unnumbered}

We acknowledge Engr. Roselyn Maaño for her supervision throughout CS Thesis I. She provided clarity when our direction faltered and pushed us toward a stronger outcome. This study carries the imprint of her guidance.

# Dedication {#dedication .unnumbered}

This work is dedicated to Almighty God, for His grace, guidance, and wisdom.

To our families, for their constant support and understanding.

To our research adviser and the faculty of CCMS, for their instruction and high standards.

And to ourselves. For the dedication to see this through. For perseverance when progress is stalled. For finishing what we started together.

# **Table of Contents** {#table-of-contents .TOC-Heading .unnumbered}

[Approval Sheet [iv](#_Toc236151306)](#_Toc236151306)

[Acknowledgement [v](#acknowledgement)](#acknowledgement)

[Dedication [vi](#dedication)](#dedication)

[1 Abstract [xiv](#abstract)](#abstract)

[2 Introduction [2](#introduction)](#introduction)

[1.2.3 Background of the Study [2](#background-of-the-study)](#background-of-the-study)

[2.2.3 Statement of the Problem [4](#statement-of-the-problem)](#statement-of-the-problem)

[3.2.3 Main and Specific Objectives [5](#main-and-specific-objectives)](#main-and-specific-objectives)

[4.2.3 Significance of the research [6](#significance-of-the-research)](#significance-of-the-research)

[5.2.3 Scope and Limitation [9](#scope-and-limitation)](#scope-and-limitation)

[3 Theoretical Framework [10](#theoretical-framework)](#theoretical-framework)

[1.2.3 Concept Map [10](#concept-map)](#concept-map)

[2.2.3 Review of Related Literature [10](#review-of-related-literature)](#review-of-related-literature)

[3.2.1 Trust Theory in Technology-Mediated Interactions [11](#trust-theory-in-technology-mediated-interactions)](#trust-theory-in-technology-mediated-interactions)

[3.2.2 Sustainable Transportation Theory [12](#sustainable-transportation-theory)](#sustainable-transportation-theory)

[3.2.3 Synthesis of the Literature and Identified Gaps [13](#synthesis-of-the-literature-and-identified-gaps)](#synthesis-of-the-literature-and-identified-gaps)

[3.2.3.1 What the Literature Confirms [13](#what-the-literature-confirms)](#what-the-literature-confirms)

[3.2.3.2 Gaps in the Existing Literature [14](#gaps-in-the-existing-literature)](#gaps-in-the-existing-literature)

[3.2.3.3 Position of RideShareEU Within the Literature [15](#position-of-rideshareeu-within-the-literature)](#position-of-rideshareeu-within-the-literature)

[3.3.1 Campus Carpooling System Studies [16](#campus-carpooling-system-studies)](#campus-carpooling-system-studies)

[3.3.1.1 Carpooling: Automatic Pairings for University Carpooling [16](#carpooling-automatic-pairings-for-university-carpooling)](#carpooling-automatic-pairings-for-university-carpooling)

[3.3.1.2 Campus Carpooling Using Hybrid Ridesharing Algorithm [17](#campus-carpooling-using-hybrid-ridesharing-algorithm)](#campus-carpooling-using-hybrid-ridesharing-algorithm)

[3.3.1.3 Ridesharing Web Application for College Students [17](#ridesharing-web-application-for-college-students)](#ridesharing-web-application-for-college-students)

[3.3.2 Safety and Verification Focused Studies [18](#safety-and-verification-focused-studies)](#safety-and-verification-focused-studies)

[3.3.2.1 Designing a Secure and Efficient Campus Carpooling System [18](#designing-a-secure-and-efficient-campus-carpooling-system)](#designing-a-secure-and-efficient-campus-carpooling-system)

[3.3.2.2 Towards Sustainable Commuting: Carpool Platform with Real-Time Tracking [18](#towards-sustainable-commuting-carpool-platform-with-real-time-tracking)](#towards-sustainable-commuting-carpool-platform-with-real-time-tracking)

[3.3.3 Requirement Engineering and User-Centered Studies [19](#requirement-engineering-and-user-centered-studies)](#requirement-engineering-and-user-centered-studies)

[3.3.3.1 Enhancing Campus Mobility: Requirement Engineering Approach [19](#enhancing-campus-mobility-requirement-engineering-approach)](#enhancing-campus-mobility-requirement-engineering-approach)

[3.3.3.2 Factors Affecting College Students\' Attitudes Toward Carpooling [20](#factors-affecting-college-students-attitudes-toward-carpooling)](#factors-affecting-college-students-attitudes-toward-carpooling)

[3.3.4 Ridesharing as a Sustainable Transportation Alternative [20](#ridesharing-as-a-sustainable-transportation-alternative)](#ridesharing-as-a-sustainable-transportation-alternative)

[3.3.4.1 Najran University Case Study [20](#najran-university-case-study)](#najran-university-case-study)

[3.3.4.2 Peer-to-Peer Carpooling: Path to Sustainable Transportation [21](#peer-to-peer-carpooling-path-to-sustainable-transportation)](#peer-to-peer-carpooling-path-to-sustainable-transportation)

[3.3.5 Synthesis of Related Studies [21](#synthesis-of-related-studies)](#synthesis-of-related-studies)

[3.4 Conceptual Framework [23](#conceptual-framework)](#conceptual-framework)

[3.4.1 Input Variables [24](#input-variables)](#input-variables)

[3.4.2 Process Variables [25](#process-variables)](#process-variables)

[3.4.3 Output Variables [25](#output-variables)](#output-variables)

[3.4.4 Moderating Variables [25](#moderating-variables)](#moderating-variables)

[3.4.5 Framework Summary [26](#framework-summary)](#framework-summary)

[3.5 Definition of Terms [27](#definition-of-terms)](#definition-of-terms)

[3.6 Acronyms [30](#acronyms)](#acronyms)

[4 Operational Framework [32](#operational-framework)](#operational-framework)

[1.2.3 Materials [32](#materials)](#materials)

[3.2.3.3 Software Requirements/ Constraints [32](#software-requirements-constraints)](#software-requirements-constraints)

[3.2.3.3 Hardware Requirements/ Constraints [35](#hardware-requirements-constraints)](#hardware-requirements-constraints)

[3.2.3.3 Data [36](#data)](#data)

[5 Description of Methods or Approach [39](#description-of-methods-or-approach)](#description-of-methods-or-approach)

[3.2.3.3 Requirements Definition [40](#requirements-definition)](#requirements-definition)

[3.2.3.3 Functional Requirements [41](#functional-requirements)](#functional-requirements)

[3.2.3.3 Non-functional Requirements [42](#non-functional-requirements)](#non-functional-requirements)

[5.1.4 Design Architecture of the System [43](#design-architecture-of-the-system)](#design-architecture-of-the-system)

[Stage 1: Filtering [52](#stage-1-filtering)](#stage-1-filtering)

[Stage 2: Scoring [53](#stage-2-scoring)](#stage-2-scoring)

[Ranking and Output [55](#ranking-and-output)](#ranking-and-output)

[Algorithm Pseudocode [55](#algorithm-pseudocode)](#algorithm-pseudocode)

[Fuel Share Calculation [56](#fuel-share-calculation)](#fuel-share-calculation)

[Complexity and Performance Targets [57](#complexity-and-performance-targets)](#complexity-and-performance-targets)

[Algorithm Validation [57](#algorithm-validation)](#algorithm-validation)

[B. Description of Methods or Approach [58](#b.-description-of-methods-or-approach)](#b.-description-of-methods-or-approach)

[Development Methodology [58](#development-methodology)](#development-methodology)

[Data Gathering Procedure [59](#data-gathering-procedure)](#data-gathering-procedure)

[**a. Comprehensive Discussion on Theorems and Definitions** [59](#a.-comprehensive-discussion-on-theorems-and-definitions)](#a.-comprehensive-discussion-on-theorems-and-definitions)

[**b. Fundamental Algorithms** [60](#b.-fundamental-algorithms)](#b.-fundamental-algorithms)

[**c. Mathematical Models and Formulas** [61](#c.-mathematical-models-and-formulas)](#c.-mathematical-models-and-formulas)

[Design Phases of the Study [62](#design-phases-of-the-study)](#design-phases-of-the-study)

[**a. Data Pre-Processing Techniques** [62](#a.-data-pre-processing-techniques)](#a.-data-pre-processing-techniques)

[3. Development Phases of the Study [62](#development-phases-of-the-study)](#development-phases-of-the-study)

[**a. Modelling and Experimentation** [63](#a.-modelling-and-experimentation)](#a.-modelling-and-experimentation)

[4. Testing Procedure [63](#testing-procedure)](#testing-procedure)

[**a. Training and Validation of the Algorithm** [63](#a.-training-and-validation-of-the-algorithm)](#a.-training-and-validation-of-the-algorithm)

[5. Quality Requirements and Evaluation of Results [64](#quality-requirements-and-evaluation-of-results)](#quality-requirements-and-evaluation-of-results)

[6. Ethics Consideration [66](#ethics-consideration)](#ethics-consideration)

[5.1.3 Description of prototype, where applicable [67](#description-of-prototype-where-applicable)](#description-of-prototype-where-applicable)

[3.2.3.3 Development Phases of the System [71](#development-phases-of-the-system)](#development-phases-of-the-system)

[3.2.3.3 Testing Procedure and Evaluation Procedure [72](#testing-procedure-and-evaluation-procedure)](#testing-procedure-and-evaluation-procedure)

[3.2.3.3 Implementation Plan of the System [73](#implementation-plan-of-the-system)](#implementation-plan-of-the-system)

[2.2.3 CS Thesis Workplan [75](#cs-thesis-workplan)](#cs-thesis-workplan)

[6 Ethics Consideration [76](#ethics-consideration-1)](#ethics-consideration-1)

[7 References [78](#references)](#references)

[8 Statement of AI Declaration [82](#statement-of-ai-declaration)](#statement-of-ai-declaration)

**\
**

**TABLE OF FIGURES**

Fig. 1 -- Concept Map 10

Fig. 2 -- IPO Framework for a Web-Based Carpool Coordination System for a Verified University Community 23

Fig. 3 -- Kanban Architecture 39

Fig. 4 -- Class Diagram 44

Fig. 5 -- Use Case Diagram 45

Fig. 6 -- Sequence Diagram 46

Fig. 7 -- Activity Diagram 47

Fig. 8 -- Priority-Scored Greedy Algorithm (PSGA) 49

Fig. 9 -- Dashboard Screen 66

Fig. 10 -- My Trips Screen 67

Fig. 11 -- Find a Ride Screen 68

Fig. 12 -- Post a Trip Screen 69

Fig. 13 -- Deployment Architecture\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\...\.....73

**\
**

**LIST OF TABLES**

Table I -- Software Tools 32

Table II -- Hardware Tools 35

Table III -- Complexity and Performance Targets 56

Table IV -- Mathematical Models and Formulas 60

Table V -- CS Thesis Workplan 73

Table VI -- AI Declaration 81

**CS Thesis Title: RideShareEU**: A Priority-Scored Greedy Matching Algorithm for Optimizing Schedule-Based University Carpooling

+------------------------------+-----------------------------------------------+
| **Name of Researchers**      | **:** De Asis, Von Altair R.                  |
|                              |                                               |
|                              | **:** Dimacali, Xyrus Lorenz M.               |
|                              |                                               |
|                              | **:** Sayat, Nash Adriane D.                  |
+==============================+===============================================+
| **Degree**                   | **: Bachelor of Science in Computer Science** |
+------------------------------+-----------------------------------------------+
| **Specialization**           | **: Software Engineering**                    |
+------------------------------+-----------------------------------------------+
| **Name of Research Adviser** | **:**                                         |
+------------------------------+-----------------------------------------------+

# Abstract

This study presents the design, implementation, and validation of a Priority-Scored Greedy Algorithm (PSGA) for schedule-based university carpooling, integrated into RideShareEU, a web-based carpool coordination platform restricted to the Manuel S. Enverga University Foundation (MSEUF) community. Access requires a school email address (@student.mseuf.edu.ph or @mseuf.edu.ph) confirmed with an emailed one-time code, and posting a trip as a driver requires a verified driver's license. The core software engineering contribution is a two-stage matching engine. Stage 1 keeps only the trips a passenger may join (seats, Women+ and familiar-rider rules) that run on the chosen date, travel in the passenger's direction, cover at least 40% of the passenger's route within a 1.5 km corridor, and leave within the passenger's flexibility window. Stage 2 ranks the remaining trips by a weighted score of route overlap (0.5), schedule alignment (0.3), and preference compatibility (0.2). Around the algorithm, the platform supports one-time and repeating trips, host approval of join requests, a daily trip lifecycle (confirm, start, pick up, end), a live trip map, trip chat, phone push notifications, ratings, reports, and administrator moderation. The suggested fuel share per seat is capped by an official fuel price read automatically from the Department of Energy's weekly price monitoring. The system is built with Next.js, Express, and PostgreSQL and is deployed on Vercel and Railway. The PSGA is validated independently from the web application on a synthetic dataset of 500 passenger-trip pairs (100 passenger queries with five candidate trips each). A second, independently written implementation reproduced every score exactly, and the PSGA's top result satisfied every hard rule in all 100 queries, against 26 to 57 for the random, route-only, and first-posted baselines. Precision at rank 1 and recall are measured against a ground truth labeled by human evaluators. A local load test sustained 600 simultaneous users with 95% of requests answered within 0.7 seconds. The deployed system is evaluated with ISO/IEC 25010 and the System Usability Scale through user acceptance testing with students, faculty, and staff, and with evaluators from the ICTD, the Sustainability office, and the Transportation office.

***Index Terms:** Campus carpooling, Priority-scored greedy algorithm, University ride sharing, Identity verification, Sustainable commuting, Software engineering, ISO 25010, Web application, Fuel cost reduction.*

# Introduction

## Background of the Study

Fuel prices in the Philippines have risen consistently in recent years. For students, faculty, and employees who drive alone to campus every day, this means a growing portion of their income goes directly to fuel with no way to offset it. At the same time, roads near Philippine universities remain congested during peak hours, extending travel time and compounding the cost of solo commuting. Vehicle emissions from low-occupancy private cars contribute to air quality problems in surrounding communities, and ride sharing has been linked to measurable improvements in urban air quality \[32\]. These three pressures, rising fuel costs, congestion, and emissions, share a common root cause. Most vehicles on the road carry only one person.

Ride sharing addresses this directly. It fills seats that already exist in vehicles already making the trip. A driver who gets even one passenger immediately reduces their personal fuel cost for that trip. No new behavior is required, only coordination.

The impact of organized ride sharing is measurable. A framework comparing ways of commuting to a German university campus found that ride sharing produced the lowest CO2 emissions of the modes compared, because it markedly reduced the total distance traveled \[12\]. On the road network of Lyon, France, grouping the most shareable trips allowed a ride-sharing service to match about half a million morning-peak requests with high-quality solutions in a short time \[45\]. These results show what becomes possible when commuters with compatible routes and schedules are matched consistently.

University campuses are well suited for this kind of system. Students, faculty, and employees travel between fixed residential areas and a central campus on predictable schedules throughout the academic year, and students\' satisfaction with university transportation and transit services has become a research topic in its own right \[28\], \[41\]. This regularity makes the matching problem tractable. Existing commercial platforms do not serve this context well. Most ride-sharing systems and matching methods are designed for single, on-demand trips \[5\], \[19\], \[46\], while campus commuting is recurring and tied to class and work schedules; a survey at Najran University found that having fixed class or work schedules increased the likelihood of ridesharing \[35\]. No dedicated platform exists for most Philippine university communities.

Research on ride sharing adoption identifies consistent barriers: distrust between users, low perceived convenience, and safety concerns \[15\], with perceived risk weakening people\'s willingness to use ride-sharing services \[34\]. A campus-focused platform can address these directly. Restricting access to verified university members through institutional identity credentials removes the stranger problem entirely. Users share a campus, a code of conduct, and traceable identities. That foundation makes trust achievable without relying on reputation systems built from scratch.

The technical side of the problem is solved. Algorithms for matching riders to drivers based on route overlap and schedule compatibility are well documented. Greedy matching methods process requests efficiently by inserting each request where it fits best \[5\], and carpool and taxi-sharing systems have long scheduled riders and drivers under time, capacity, and cost constraints \[4\], \[6\]. Campus and college ride-sharing systems have been built with user registration, ride posting, and matching \[7\], \[16\], \[36\], \[37\]. The gap is not a missing algorithm. The gap is a system that applies these methods within a trusted, closed network built for a specific university community.

RideShareEU fills that gap. It is a web-based carpool coordination platform restricted to verified members of a university community: every account is created with a school email address that the user proves they control with an emailed one-time code. The core matching engine uses a priority-scored greedy algorithm. It works in two stages: first it keeps only the trips the passenger may join that run on the chosen date, go the passenger's way, and leave within the passenger's departure time flexibility; then it ranks them by route overlap, schedule alignment, and the passenger's stated preferences (Women+ trips and familiar riders). Drivers post trips as ride hosts after their driver's license is verified. Passengers request to join. Hosts approve manually. Cost sharing is arranged directly between users outside the platform. The suggested contribution is framed as a voluntary fuel share. No fares, no payments, and no earnings are processed by the system.

The goal is a practical, everyday tool that reduces the fuel cost burden on campus commuters. The thesis contribution lies in three areas: the design of the priority-scored matching logic, the architecture of a trusted institutional platform with verified identity as its access foundation, and the efficient software realization of both within a standard web application stack. The contribution of this study is not in transportation planning but in software engineering: the design and validation of a matching algorithm and the trusted institutional platform architecture that makes it deployable within a university community.

## Statement of the Problem 

Students, faculty, and employees at Philippine universities face rising fuel prices, daily congestion, and a lack of safe alternatives to solo vehicle use. Those who drive alone absorb the full cost of fuel every trip with no way to distribute that cost. Commercial ride-hailing platforms are not built for recurring, schedule-based campus commutes and do not provide the identity verification that institutional communities require for trust.

A dedicated campus carpool coordination system is missing. The system needs to verify users as university members, match them for scheduled recurring trips based on route and preference compatibility, and operate as a private coordination platform rather than a commercial transport service. The algorithms for this kind of matching exist. The software engineering challenge is building a system that matches correctly and quickly within a bounded two-second response constraint and operates safely within the access-controlled boundaries of a closed institutional network, where identity verification, preference filtering, and algorithmic ranking must work together as an integrated and testable system. Applying them correctly within a verified, closed campus network is the gap this project addresses.

## Main and Specific Objectives

The main objective is to design, develop, and evaluate RideShareEU, a web-based carpool coordination platform for a verified university community. The system will use a priority-scored greedy matching algorithm to facilitate safe, recurring, and route-based ride sharing with the goal of reducing individual fuel costs and the total number of solo vehicle trips among campus commuters.

Specific Objectives

1.  Document the commuting cost burden faced by students, faculty, and employees at MSEUF as contextual evidence for the economic motivation underlying the carpooling platform, treated as background input rather than a primary engineering deliverable.

2.  Design the system architecture and database for a secure, web-based carpool coordination platform with institutional identity verification.

3.  Develop core functionalities, including user authentication via school email verification, driver's license verification, trip posting by ride hosts, a daily trip lifecycle, and a two-stage priority-scored greedy matching algorithm for scheduled commutes.

4.  Validate the Priority-Scored Greedy Algorithm as an independent computational artifact using synthetic match scenarios with controlled inputs, measuring precision at rank 1, recall, and match quality against an expert-defined ground truth, before integration into the full web application.

5.  Implement safety and trust features, including ride history, ratings and reviews, a report and flag system, Women+ trips, a live trip map with optional passenger location sharing, and administrator moderation.

6.  Evaluate the system based on functionality, performance, security, usability, and user satisfaction using standard software evaluation methods.

## Significance of the research

Daily commuting to and from Enverga University places a direct financial burden on students, faculty, and staff who travel by private vehicle. Most of these vehicles carry only the driver. Fuel costs in the Philippines have risen consistently since 2022, and road congestion near campus peaks during morning and afternoon class schedules. RideShareEU targets this directly. It is a web-based carpool coordination platform built for the verified university community using the Priority-Scored Greedy Algorithm (PSGA) to match Ride Hosts with Passengers based on route, schedule, and preferences.

The following groups benefit from this system.

**Students.** Students bear the highest transportation cost relative to income. A single carpool match from a residential area to campus can split fuel cost across two to four people. Over one semester, this reduces out-of-pocket transport spending for both the Ride Host and the Passenger. The identity-verified closed network removes the distrust barrier that prevents students from using general-purpose ride-sharing apps. Every search result and trip page shows the suggested fuel share per seat, giving students a concrete cost figure before they request a trip.

**Faculty and Staff.** Faculty and staff members travel from fixed residential areas on predictable daily schedules, which makes them strong candidates for recurring carpool matches. The recurrence setting lets a Ride Host post a single trip that repeats daily, on weekdays, or on selected days of the week. A Passenger who is approved on that trip rides on every one of its days without re-submitting a search each day. The evening before each trip day, the host is asked to confirm that they are driving, and a host who is not driving on a given day can skip it, which notifies the riders. This reduces coordination overhead for both parties and keeps fuel share benefits consistent throughout the academic term.

**Female Commuters.** Research on ride-sharing adoption identifies safety and perceived risk as major barriers \[15\], \[34\], and a university study found that women were more likely than men to be interested in ridesharing when it was available \[35\]. RideShareEU addresses this through two mechanisms. First, access requires a verified school email address, which limits the platform to known, traceable university members, and every driver's license is checked before the driver can post a trip. Second, the platform offers Women+ trips, open only to women and non-binary riders and hosted only by women and non-binary drivers. A host chooses who can join (Anyone or Women+ only), and a passenger can choose to see Women+ trips only. The server applies both as hard constraints before PSGA scoring: a trip the passenger cannot join never appears in the results, cannot be opened from a shared link, and is refused if requested directly. Gender is self-declared, optional, and never shown to other users; trips display their rule ("Women+ trip"), never a person's gender. A passenger who chose Women+ trips is warned before requesting a trip that is open to everyone.

**The University Administration.** Campus-adjacent congestion during arrival and departure peaks creates operational challenges for the university. Each additional carpool match reduces the number of single-occupancy vehicles entering the campus perimeter. The system does not require institutional infrastructure changes. It runs entirely as a web application accessible from any browser and can be added to a phone's home screen like an app. The administration receives a functional tool that addresses a documented campus traffic problem without procurement of hardware or modification of existing systems.

**Future Researchers and Developers.** RideShareEU produces a validated implementation of the Priority-Scored Greedy Algorithm for carpool matching in a bounded, identity-verified community. The PSGA formulation, weight configuration, and evaluation results contribute to the documented body of campus carpooling algorithms. To the researchers' knowledge, the implementation is the first application of a priority-scored greedy approach to a Philippine university commute context, where tropical scheduling patterns and single-semester academic cycles differ from the European and North American datasets that dominate existing literature. The practical research contribution is specifically threefold: the PSGA formulation and weight configuration are documented as a reusable algorithmic artifact; the verified identity integration architecture provides a reference pattern for other institutional platforms requiring closed-network access control; and the recurring-trip coordination model documents standing match agreements in a Philippine university commuting context, which the reviewed literature does not cover.

**The Local Community and Environment.** Enverga University is located in Lucena City, where traffic density on approach roads during academic hours affects residents beyond the university boundary. Fewer single-occupancy vehicles reduce fuel consumption, vehicle emissions, and road congestion for the surrounding area. Each matched trip that fills otherwise empty seats decreases the total number of vehicle trips between the residential origin clusters and the campus destination.

**Summary of benefits.** In practical terms, the study gives commuters a free tool that lowers their fuel costs and the effort of arranging shared rides, and gives the university a working platform it could adopt. Academically, it contributes a documented, validated matching algorithm, its evaluation procedure, and a complete development case in a Philippine university setting. For society, it promotes safer ride sharing among verified members and fewer vehicles on the road. For policy, its results can inform the university and local offices when they consider carpooling programs and campus transport and parking policies.

## Scope and Limitation

The project covers the development and deployment of a functional web application for the MSEUF community. Access is restricted to students, faculty, and staff with a school email address (@student.mseuf.edu.ph or @mseuf.edu.ph), confirmed with a six-digit code sent to that address; the system does not connect to university records, which minimizes administrative integration risks while maintaining closed-network security. Each user switches between a Passenger mode and a Driver mode. Core features include ride host trip posting (one-time or repeating, with a saved car, meeting point, and map route), rider join requests, manual host approval, and a two-stage matching algorithm. A driver must submit a photo of their driver's license, taken with the in-app camera, before posting a trip; an automatic text-recognition check compares it with the typed details and approves a consistent license, and an administrator reviews the rest. Each day of a trip has its own lifecycle: the host confirms or skips the day, starts the trip, marks riders as picked up, and ends it, and a host who does not start is recorded as a no-show. While a trip runs, approved riders follow the car on a live map and may share their own location until pickup. Safety and trust features include institutional identity verification, Women+ trips, a mutual ratings and review system, trip chat, phone push notifications, a report and flag mechanism, official warnings, and a Help page. Reports trigger an automatic strike ladder of temporary and permanent suspensions; designated administrators also review reports, issue warnings, can suspend or reinstate accounts, cancel unsafe trips, review driver's licenses, and confirm the official fuel price that the system reads from the Department of Energy, and every administrative action is recorded in an audit log. Administrators cannot read trip conversations. A Help page gives emergency guidance (call 911) and lets users send requests to the administrators, who answer them in a support inbox; administrators can also post announcements to all users and monitor open queues, daily activity, security events (stored without IP addresses or emails and deleted after 30 days), and a watch list of users with repeated cancellations or reports, which only flags users for review and never acts automatically. These features are consistently reflected in the system objectives, conceptual framework, and design modules. The first stage filters trips by eligibility, date, direction, route overlap, and schedule compatibility. The second stage ranks the remaining trips by route overlap, schedule alignment, and preference compatibility.

The platform does not process payments. Cost sharing is arranged directly between users. The suggested contribution is framed as a voluntary fuel share, not a fare. The system does not charge platform fees; the driver's "My driving" page totals only the fuel share the app showed to riders. Places are limited to Luzon. The algorithm is validated on synthetic data; the deployed system is evaluated through a user acceptance test with test accounts and test trips, not through a full campus rollout. Evaluation focuses on technical functionality, performance, security, and initial user feedback.

The study has the following limitations. The license check confirms that the photo is consistent with the typed details; it cannot confirm that a license is genuine, since no public Land Transportation Office (LTO) verification service is available. Gender is self-declared and not verified. A web page cannot send GPS location while it is in the background, so riders see the driver's position paused while the driver uses Google Maps or Waze or turns off the screen. Phone notifications on an iPhone require iOS 16.4 or later and the app added to the home screen. Seats are counted per trip, not per day of a repeating trip. A single API process served about 600 simultaneous users in the load test; more would need additional processes. Advanced optimization techniques such as machine learning-based demand prediction and real-time dynamic dispatch are beyond the current scope. The system focuses on scheduled, recurring trips rather than on-demand ride matching.

**Research site.** The study is conducted at Manuel S. Enverga University Foundation in Lucena City. The site was chosen for four reasons. First, it is the researchers\' own institution, so the study can be carried out with the endorsement of its offices and evaluated by its ICTD, Sustainability office, and Transportation office. Second, MSEUF draws students, faculty, and staff from towns along the Quezon corridor (such as Sariaya, Tayabas, and Lucban) who commute to one campus on predictable class and work schedules, which is the recurring, many-to-one travel pattern the matching algorithm is designed for. Third, every member has an institutional email address, which makes verified, closed-community access possible without a connection to university records. Fourth, the fuel cost and congestion problems described in the Background of the Study apply to these daily commutes, so the problem the study addresses is present at the site. Because the findings come from one institution, they may not transfer directly to universities with different commuting patterns.

# Theoretical Framework

## Concept Map

![](figures/fig01-concept.png){width="6.3in"}Fig. 1 Concept Map

## Review of Related Literature 

**Introduction**

> ***Technology Acceptance Model***

Technology acceptance models provide a framework for predicting and explaining user adoption of information systems. The Technology Acceptance Model posits that perceived usefulness and perceived ease of use are the primary determinants of adoption intention for a new technology \[51\]. Applied to ride-sharing platforms, perceived usefulness maps to the economic and convenience benefits users expect to receive, while perceived ease of use maps to the learnability and efficiency of the interface. Studies of ride-sharing and carpooling adoption point to the same benefit-side factors: a systematic review identifies cost, convenience, and trust among the main user factors and barriers \[15\], and a survey of 514 students at Shenzhen University found that safety and high cost left students neutral toward carpooling, with comfort as their main concern \[27\].

> ***Theory of Planned Behavior***

The Theory of Planned Behavior extends this view by adding social influence and perceived control as determinants of intention: attitudes, subjective norms (the perception that people one respects approve of or perform a behavior), and perceived behavioral control together shape what a person intends to do \[52\]. For RideShareEU, the design implication is that social visibility features, such as showing each member\'s completed trips and ratings on their profile, can leverage peer influence to drive adoption, while features that let users control their own schedule and choices support perceived behavioral control.

A study of university students found that environmental triggers influence their intention to use ride-sharing services, and that perceived risk moderates this effect \[34\]. Safety features must therefore be in place and communicated before sustainability messaging can be expected to have an effect. For RideShareEU, TAM and TPB serve a narrow and targeted purpose they explain which design features are needed to encourage adoption, not how the system is engineered. The verified identity badge addresses the trust barrier; the fuel share shown on every trip addresses perceived usefulness from TAM; and the trip counts and ratings on members' profiles, which make other members' participation visible, address subjective norms from TPB. These three connections are the extent to which behavioral theory shapes the platform. The core contribution of this thesis remains in software engineering the PSGA formulation, the verified identity architecture, and their integration into a functioning web application. The theoretical framing is kept to these targeted connections intentionally, so it does not overshadow the engineering work.

### 3.2.1 Trust Theory in Technology-Mediated Interactions {#trust-theory-in-technology-mediated-interactions .unnumbered}

> *3.2.1.1 Dimensions of Trust in Ride Sharing*

Trust in technology-mediated interactions has been studied extensively in the context of online marketplaces, sharing economy platforms, and collaborative consumption services. The key insight is that trust is not a single construct. It involves trust in the platform\'s security, trust in the counterpart\'s identity, trust in the counterpart\'s behavior, and trust in the institutional backing of the system. Each type of trust is addressed by different design and policy mechanisms.

> *3.2.1.2 Institutional Trust as a Foundation*

For a campus ride-sharing platform, institutional trust is the most foundational. When the university formally endorses the platform and takes responsibility for user verification, it lends its own credibility to the system. This institutional trust reduces the cognitive burden on individual users, who no longer need to independently evaluate the trustworthiness of each potential ride partner \[53\]. Campus carpooling requirement studies likewise list user registration and security as core requirements \[24\], \[25\], and community-aware ridesharing research groups riders by their social ties to make shared trips more acceptable \[29\], \[50\].

Identity trust, confidence that the matched person is who they claim to be, is addressed by the verification mechanism. Behavioral trust, confidence that the matched person will behave appropriately during the ride, is addressed by the rating and review system. Platform security trust, confidence that personal data is handled safely, is addressed by encryption and data governance practices. A complete trust framework for RideShareEU requires all four elements: institutional endorsement, identity verification, behavioral rating, and data security.

### 3.2.2 Sustainable Transportation Theory {#sustainable-transportation-theory .unnumbered}

> *3.2.2.1 Cultural and Institutional Barriers to Adoption*

Sustainable transportation theory examines how transportation systems can meet current mobility needs without compromising future environmental conditions. Carpooling is one of the most direct interventions available because it reduces vehicle use without requiring changes to vehicle technology or fuel sources. The efficiency gain is immediate and proportional to the increase in average vehicle occupancy.

Reviews of ride-sharing adoption find that the main barriers lie in user factors such as trust, cost, convenience, and safety rather than in the matching technology itself \[15\], \[33\], and studies of university students\' shared travel behavior examine these factors in the campus setting \[40\]. Carpool matching itself has been studied extensively \[4\], \[43\]. The challenge is creating the social conditions under which people routinely choose coordinated travel over solo travel. University campuses are social environments with existing community bonds and shared institutional values. They represent favorable conditions for overcoming the cultural barriers to carpooling adoption that resist intervention in more anonymous urban contexts.

> *3.2.2.2 How the Theories Underpin the Study*

The four theories are used together because each explains a different reason a member of the university community would, or would not, share a ride, and each points to specific variables, system features, and evaluation items in this study.

**Technology Acceptance Model (TAM).** TAM holds that a person\'s intention to use a system is shaped mainly by its perceived usefulness, the belief that it will improve their performance or situation, and its perceived ease of use, the belief that using it will be free of effort \[51\]. In this study, perceived usefulness corresponds to the cost and convenience a commuter expects from carpooling, which RideShareEU makes concrete by showing the fuel share per seat on every trip and by ranking only the trips that go the user\'s way at a time that suits them. Perceived ease of use corresponds to how quickly a user can find, request, post, and run a trip. Both are measured directly in the evaluation: the usability items (learnability, operability, appropriateness recognizability) and the System Usability Scale measure ease of use, and the domain items on cost and the SUS item on wanting to use the system frequently measure usefulness and intention to use.

**Theory of Planned Behavior (TPB).** TPB explains intention through three factors: the person\'s attitude toward the behavior, subjective norms (whether people who matter to them approve of or perform it), and perceived behavioral control (whether they feel able to perform it) \[52\]. Applied to carpooling, attitude is the commuter\'s view of sharing a ride, subjective norms are whether fellow students and employees are seen to carpool, and perceived behavioral control is whether carpooling fits their own schedule and situation. RideShareEU addresses subjective norms by showing each member\'s completed trips and ratings on their profile, and perceived behavioral control by letting users set their own flexibility window, choose who may join their trips, switch between Passenger and Driver modes, confirm or skip individual trip days, and cancel early. The intention component is reflected in the evaluation\'s adoption item and in the SUS.

**Trust theory.** Trust is the willingness to accept vulnerability based on positive expectations of another party, built on that party\'s perceived ability, benevolence, and integrity \[53\]. Carpooling with someone outside one\'s circle requires exactly this kind of trust. The study separates four forms (Section 3.2.1): identity trust, built by school email verification and, for drivers, the driver\'s license check; behavioral trust, built by ratings, reviews, and the reporting and warning system; institutional trust, built by restricting the platform to the MSEUF community; and platform security trust, built by encryption, access control, and the privacy rules. These are the safety variables of the conceptual framework, and they are evaluated through the security items rated by the ICTD and the safety items rated by the Sustainability and Transportation offices.

**Sustainable transportation theory.** This theory explains that the environmental and congestion benefits of carpooling grow with average vehicle occupancy \[12\], \[32\], while user and institutional factors, rather than technology, decide whether people adopt it \[15\]. It underpins the study\'s outcome variables: the number of riders per completed trip (recorded by the system for each trip day) and the reduction in solo vehicle trips to campus. It also justifies the institutional design of RideShareEU, which uses the existing university community to lower the social barriers that the theory identifies, and it is evaluated through the mobility impact and sustainability items rated by the two university offices.

Taken together, TAM and TPB explain whether a verified member will choose to use the platform, trust theory explains whether they will feel safe enough to ride with another member, and sustainable transportation theory explains why their combined choices matter beyond the individual. The conceptual framework in Section 3.4 follows this structure: identity verification and trust formation (trust theory), matching and fuel share display (TAM), the social and control features (TPB), and fewer solo trips as the outcome (sustainable transportation theory).

## 3.2.3 Synthesis of the Literature and Identified Gaps {#synthesis-of-the-literature-and-identified-gaps .unnumbered}

### 3.2.3.1 What the Literature Confirms {#what-the-literature-confirms .unnumbered}

The literature reviewed in the preceding sections establishes several conclusions that directly inform the design of RideShareEU. Traffic congestion, rising fuel costs, and environmental harm from private vehicle use are well-documented problems that organized ride sharing can address \[32\], \[33\], \[43\]. Simulation and implementation studies show that organized carpooling and ride sharing can reduce distance traveled and emissions for campus commuters \[12\], \[13\] and optimize the number of passengers per vehicle on routine trips \[8\], which has the potential to reduce vehicle trips and individual fuel expenses when participation rates are sufficient. The peer-to-peer model is particularly effective in communities with predictable, recurring travel patterns between common origin-destination pairs.

The university setting satisfies the conditions for effective peer-to-peer carpooling in ways that general urban contexts do not \[8\], \[35\]. At Najran University, fixed class and work schedules, longer distances to campus, limited public transport, and a similar social background among students and staff all increased the propensity to rideshare \[35\]; campus studies in Spain, Italy, and Germany likewise examine carpooling and car sharing for students and staff \[9\], \[12\], \[17\]. Origin-destination concentration on the campus, schedule predictability from academic timetables, and existing community bonds among students and staff all reduce the barriers to successful matching. The trust problem, one of the most significant barriers to general-population ride sharing \[15\], can be reduced by the institutional verification available to a university platform \[24\], \[25\].

The technical requirements for a campus carpooling platform are well established in the literature \[16\], \[24\], \[25\], and campus mobility applications for bus tracking, navigation, and vehicle sharing show that such services can be delivered on students\' own devices \[1\], \[2\], \[10\]. Core functional requirements include verified user authentication, ride posting with recurrence support, priority-scored greedy matching ranked by route and schedule compatibility, and a communication module for match confirmation. These requirements are achievable with standard web development tools and do not require specialized infrastructure.

### 3.2.3.2 Gaps in the Existing Literature {#gaps-in-the-existing-literature .unnumbered}

Despite the volume of research on ride sharing and campus mobility, specific gaps remain that RideShareEU addresses.

**Gap 1: Geographic and Contextual Gap:** The majority of documented campus carpooling systems come from contexts in Europe, North America, South America, East and South Asia, and the Middle East \[8\], \[9\], \[12\], \[16\], \[17\], \[27\], \[35\]. Published research on campus ride-sharing systems specifically designed for and evaluated in Southeast Asian contexts, including the Philippines, is sparse. The transportation infrastructure, commuting patterns, cost structures, and social dynamics of Philippine universities differ from these better-studied contexts. A system designed and evaluated for a Philippine university community fills this geographic and contextual gap.

**Gap 2: Full Development Cycle Documentation:** Most published campus carpool implementations focus on either the algorithmic matching component or the application architecture in isolation. Few published studies document the full development cycle from requirement specification through implementation and evaluation for a campus platform. The web application by Malode et al. \[16\] and the requirement specification and elicitation studies by Kamel et al. \[24\], \[25\] come closest, but none documents an evaluated, deployed prototype. RideShareEU aims to produce a documented, evaluated prototype that contributes a complete development case study to the literature.

**Gap 3: User Preference Integration:** The literature on user preference integration in campus carpooling matching is underdeveloped. Studies match riders using personal traits and preferences \[8\], \[14\], social as well as route networks \[29\], \[50\], and preference-based stable matching \[49\], but few specify which preference dimensions have the highest impact on match acceptance rates in a campus context. RideShareEU\'s evaluation phase will contribute additional data on preference-matching outcomes in the specific context of a Philippine university community.

**Gap 4:** Fuel Cost as an Adoption Driver: The existing campus ride-sharing literature frames adoption drivers primarily in terms of convenience and environmental benefit. Few studies examine rising fuel costs as the primary economic motivator, particularly in a Philippine context where fuel prices have increased substantially and public transit alternatives are limited. RideShareEU positions fuel cost sharing as the central value proposition, which distinguishes its adoption strategy from systems that rely on environmental messaging or convenience alone.

**Gap 5: Recurring Trip Model:** The literature does not adequately address the recurring trip model as distinct from single-trip matching. The majority of ride-sharing research focuses on matching individual, on-demand trips in real time \[19\], \[45\], \[46\], \[47\], \[48\]. The university carpooling use case is fundamentally about recurring trips on fixed weekly schedules. RideShareEU addresses this by making recurring trip posting and standing match agreements core features of the system, which distinguishes it from general-purpose ride-hailing applications that dominate the existing literature.

### 3.2.3.3 Position of RideShareEU Within the Literature {#position-of-rideshareeu-within-the-literature .unnumbered}

RideShareEU occupies a specific and defensible position within the existing body of research and development. It applies established technical approaches, including greedy matching \[5\], matching for routine trips within one institution \[8\], meeting points \[11\], \[22\], and institutional identity verification \[24\], \[25\], within a context that the literature has identified as favorable but underserved. It extends the documented campus carpooling literature by providing a complete development case in a Philippine university setting with evaluation against both technical and usability standards.

The system does not attempt to push the technical frontier of matching algorithms or real-time optimization. Its contribution is practical: it demonstrates that proven carpooling technology, applied within a verified institutional community, can directly reduce individual fuel costs for campus commuters and address the specific transportation challenges of Philippine university communities in a way that commercial ride-hailing platforms cannot. This practical contribution aligns with the broader literature\'s finding that the key obstacles to ride-sharing adoption are user and social factors rather than technical ones \[15\], \[35\].

3.3 Review of Related Studies

This section presents studies whose research designs, objectives, and findings are directly comparable to RideShareEU. Unlike the thematic literature review in Section 3.2, the studies below are examined as whole research projects, with attention to their scope, methodology, target population, system features, and documented outcomes. Each study is evaluated for the specific lessons it contributes to the design and evaluation of RideShareEU.

## 3.3.1 Campus Carpooling System Studies {#campus-carpooling-system-studies .unnumbered}

### 3.3.1.1 Carpooling: Automatic Pairings for University Carpooling {#carpooling-automatic-pairings-for-university-carpooling .unnumbered}

Lugo et al. developed UCarpooling, a matching system for commuting between people in the same institution, aimed at optimizing the number of passengers in vehicles during routine trips to and from work or study \[8\]. Unlike similar proposals, it calculates the percentage of compatibility between people from both logistical details (place of departure, time of entry) and personal traits (such as smoking or music preferences). A simulation of its use at a university in Asunción, Paraguay, produced favorable results for the institution, its users, and the city.

UCarpooling is the closest functional parallel to RideShareEU: both serve the commute of a single institution and rank potential partners by a compatibility percentage built from route and schedule. RideShareEU differs in three ways: it restricts access to verified members of the institution, it treats safety preferences (Women+ trips, familiar riders) as hard constraints rather than as weighted traits, and it is evaluated as a deployed application rather than in simulation.

### 3.3.1.2 Campus Carpooling Using Hybrid Ridesharing Algorithm {#campus-carpooling-using-hybrid-ridesharing-algorithm .unnumbered}

Dharshini et al. developed a student-focused carpooling service built around a Hybrid Ridesharing Algorithm (HRA) \[7\]. On the website, drivers post their starting locations, available seats, and routes, and riders choose where they wish to be picked up. The service matches riders and drivers with a machine learning algorithm, applies dynamic pricing that varies with supply and demand, lets users choose whether rides are paid, and includes user registration and verification for security.

The study confirms the core workflow that RideShareEU also follows (drivers post routes and seats, riders request a pickup) and the importance of verification for campus users. RideShareEU takes a different position on two design choices. It uses a transparent, rule-based score rather than a learned model, so every ranking can be explained to the user, and it uses a fixed fuel share per seat, capped by the official fuel price, instead of dynamic pricing, so that riders always see the same cost and drivers cannot profit from demand.

### 3.3.1.3 Ridesharing Web Application for College Students {#ridesharing-web-application-for-college-students .unnumbered}

Malode et al. proposed a web-based ridesharing and booking framework for college students in Nashik, India, that lets owners of private vehicles offer their empty seats to others within the college network, motivated by the high fuel costs and traffic that people driving alone face \[16\]. The system, built for two-wheelers, lets users register, view available vehicles and their profiles, book rides, and share their location.

The study supports two premises of RideShareEU: that fuel cost is a direct motivation for sharing seats, and that a browser-based application is enough to coordinate rides within a college community. RideShareEU extends this design with verified institutional identity, cars with a capped per-seat fuel share, recurring trips, and algorithmic matching rather than manual booking.

## 3.3.2 Safety and Verification Focused Studies {#safety-and-verification-focused-studies .unnumbered}

### 3.3.2.1 Designing a Secure and Efficient Campus Carpooling System {#designing-a-secure-and-efficient-campus-carpooling-system .unnumbered}

Kamel et al. produced a Software Requirement Specification (SRS) for a campus carpooling system intended to improve transport efficiency, reduce traffic congestion, and ensure user safety \[24\]. The SRS sets out functional and non-functional requirements, quality requirements, and acceptance conditions for deployment, and maps requirements to stakeholders\' goals using requirement patterns. Its key features include real-time ride updates, user registration, security features, multi-platform compatibility, and an incentive-based reward scheme.

This study is the closest methodological parallel to the design phase of RideShareEU: both serve a university community, treat user registration and security as core requirements, and specify requirements in testable form. Its SRS serves as a reference for RideShareEU\'s own requirements. Where that system specifies an incentive-based reward scheme, RideShareEU relies on cost savings through the fuel share and focuses on recurring trip scheduling and route-based matching.

### 3.3.2.2 Towards Sustainable Commuting: Carpool Platform with Real-Time Tracking {#towards-sustainable-commuting-carpool-platform-with-real-time-tracking .unnumbered}

Kanagasabai et al. designed and developed a carpool ride-sharing application that connects drivers and passengers traveling along similar routes, to reduce individual travel costs, traffic congestion, and environmental impact \[30\]. Its core features include secure user authentication, trip scheduling, real-time GPS tracking, and cashless payments, complemented by safety mechanisms such as driver verification, ride preferences, and reporting tools to build trust and reliability. The project followed an Agile, user-centric approach, and its evaluation found that the platform improved commuting efficiency.

These features closely match RideShareEU\'s safety design: driver verification (RideShareEU\'s driver\'s license check), real-time tracking (the live trip map), ride preferences (Women+ and familiar-riders rules), and reporting tools. The main difference is payment: RideShareEU deliberately handles no money and only displays a suggested fuel share.

## 3.3.3 Requirement Engineering and User-Centered Studies {#requirement-engineering-and-user-centered-studies .unnumbered}

### 3.3.3.1 Enhancing Campus Mobility: Requirement Engineering Approach {#enhancing-campus-mobility-requirement-engineering-approach .unnumbered}

In a companion paper, Kamel et al. described the requirement engineering process for a carpool system that matches university staff and students for their daily commute \[25\]. Using formal elicitation techniques, namely surveys and interviews, they identified the principal issues of transport inefficiency, costly commuting, and environmental concerns, and derived functional and non-functional requirements for a secure, user-friendly, and efficient carpooling process.

The issues the study identified, costly commuting above all, are the same problems that motivate RideShareEU, and its requirement for a secure process supports RideShareEU\'s decision to restrict access to verified university members. Its elicitation approach also served as a reference for RideShareEU\'s evaluation with the university\'s students, staff, and offices.

### 3.3.3.2 Factors Affecting College Students\' Attitudes Toward Carpooling {#factors-affecting-college-students-attitudes-toward-carpooling .unnumbered}

Li, Zhang, and Gan surveyed 514 students at Shenzhen University, China, and used a multinomial logit model to examine how personal, travel, and attitude attributes affect carpooling attitudes \[27\]. Personal attributes such as sex and age had no significant effect; the safety of carpooling and its high cost left students neutral toward it, and comfort was their main concern.

This study is relevant to RideShareEU at the design and evaluation levels. It shows that cost and safety, not demographics, shape students\' attitudes, which supports RideShareEU\'s focus on a low, transparent fuel share and on safety features. Because it found no effect of sex on attitudes, RideShareEU offers Women+ trips as a choice for those who want it rather than assuming that all women share the same concern.

## 3.3.4 Ridesharing as a Sustainable Transportation Alternative {#ridesharing-as-a-sustainable-transportation-alternative .unnumbered}

### 3.3.4.1 Najran University Case Study {#najran-university-case-study .unnumbered}

AlQuhtani studied ridesharing as a sustainable transportation alternative at Najran University, a suburban Saudi Arabian institution where the population relies mainly on cars and primarily commutes alone \[35\]. Using a commuter survey and a binary logistic regression model, the study found that being female and non-Saudi, being a student or faculty member (versus staff), and having fixed work or class schedules increased the likelihood of ridesharing. It also identified the university\'s motivators for ridesharing: the lack of public transportation, fixed schedules, longer distances to campus, and a similar social background among attendees.

The Najran study is a close analog to the MSEUF context: a university whose commuters depend on private vehicles. Its findings support RideShareEU\'s design choices directly: matching around fixed schedules, serving students and faculty, building on the shared social background of one institution, and offering safety options valued by women.

### 3.3.4.2 Peer-to-Peer Carpooling: Path to Sustainable Transportation {#peer-to-peer-carpooling-path-to-sustainable-transportation .unnumbered}

Prathusha et al. implemented a peer-to-peer carpooling application for their college community \[26\]. They note that traditional carpooling systems struggle with privacy, matchmaking, and pricing, and that carpooling at colleges and organizations can reduce pollution, traffic congestion, and carbon emissions. Their ride-matching algorithm pairs riders with passengers based on nodal points and destinations to make finding compatible travel companions quicker.

The three problems the study names map to three design features of RideShareEU: privacy (encrypted personal data and restricted visibility), matchmaking (the PSGA, which also matches on route and destination), and pricing (the fixed per-seat fuel share).

## 3.3.5 Synthesis of Related Studies {#synthesis-of-related-studies .unnumbered}

The studies reviewed in this section collectively demonstrate that the campus ride-sharing system concept is feasible, that specific design choices have documented effects on adoption and satisfaction, and that the university context is consistently identified as favorable for peer-to-peer carpooling. 

The primary gap across all reviewed studies remains the absence of a complete, evaluated prototype deployed in a Philippine or broader Southeast Asian university context. The studies reviewed here were conducted in Paraguay, India, China, Saudi Arabia, and other international contexts \[8\], \[16\], \[27\], \[35\]. RideShareEU fills this gap by applying the documented best practices from these studies within the specific institutional, economic, and transportation context of a Philippine university.

From a Software Engineering standpoint, the studies in Sections 3.3.1 through 3.3.5 confirm that the dominant technical contributions in the campus carpooling literature are in matching algorithm design, verified identity architecture, and web application module structure not in behavioral adoption modeling alone. RideShareEU positions itself within this technical strand: the PSGA, the three-tier architecture, and the verified identity layer (school email verification and driver's license verification) are the engineering artifacts being contributed, while the behavioral and adoption literature serves as context for the system\'s design priorities rather than as the primary intellectual focus.

# 3.4 Conceptual Framework {#conceptual-framework .unnumbered}

![](figures/fig02-ipo.png){width="6.0in"}*Fig. 2. IPO framework for a web-based carpool coordination system for a verified university community*

The conceptual framework follows the Input-Process-Output (IPO) model, illustrating the systematic flow of activities in developing a web-based carpool coordination system for a verified university community.

Input consists of registered users (students, faculty, and staff with verified school email addresses, and drivers with verified driver's licenses), trip details including origin, destination, meeting point, departure time, recurrence, car, and seats, the institutional email domains that define the community, and system configuration parameters governing matching, safety settings, the official fuel prices, and platform policies.

Process encompasses four key stages: (1) Identity Verification confirming the school email address with a one-time code and checking each driver's license; (2) Carpool Matching a priority-scored greedy algorithm that filters trips by eligibility, date, direction, route overlap, and time window, then scores route overlap, schedule alignment, and stated preferences to generate ranked match lists; (3) Trust Formation building behavioral trust through a rating and review system while institutional endorsement establishes baseline identity trust; and (4) Real-Time Coordination delivering in-app and push notifications, showing the host's meeting point, the trip chat, and the live trip map, and displaying the fuel share per seat to minimize coordination overhead.

Output delivers the study's contributions: confirmed matched carpool rides with route and cost details, individual commuting cost savings per completed ride, a reduction in individual fuel costs through shared trips, and a contribution toward fewer solo vehicle trips within the campus commuter pool.

## 3.4.1 Input Variables {#input-variables .unnumbered}

The framework identifies three categories of inputs that shape the system\'s operation. The first category is user characteristics, which include commuting distance, vehicle ownership status, schedule regularity, and prior experience with ride-sharing platforms. These characteristics determine which users are viable candidates for carpooling and what features will most directly address their barriers to participation.

The second category is institutional context. RideShareEU operates within a university that maintains official identity records for all students, faculty, and employees. This institutional context provides the verified identity infrastructure that commercial platforms cannot replicate. The university\'s physical location, its relationship to the surrounding residential areas, and its academic calendar all define the spatial and temporal parameters of the matching problem.

The third category is platform design inputs: the specific features, interface choices, and algorithmic decisions built into RideShareEU. These include the verified identity mechanism, the recurring trip posting model, the priority-scored greedy matching algorithm, the cost calculation display, and the safety features. Each design input is derived from the empirical findings reviewed in Sections 3.2 and 3.3.

## 3.4.2 Process Variables {#process-variables .unnumbered}

The core process of the system is the matching cycle. A ride host posts a one-time or recurring trip specifying origin, route, meeting point, departure time, available seats, and who can join. A passenger submits a search request with compatible parameters. The matching algorithm evaluates eligibility, direction, route overlap, schedule compatibility, and stated preferences to generate a ranked list of candidate rides. The passenger requests to join a selected trip, and the host approves or declines the request. The system records the match and notifies both parties. On each trip day the host confirms, starts, and ends the trip, and the riders rate the driver and the driver rates the riders afterwards.

Trust formation is a parallel process. At registration, the verified identity mechanism establishes baseline identity trust. As users accumulate shared rides, behavioral trust builds through the rating and review system. Institutional trust is established at the platform level through the university\'s endorsement and access control policy. The framework posits that trust formation is a prerequisite for the matching process to produce completed rides rather than cancelled arrangements.

## 3.4.3 Output Variables {#output-variables .unnumbered}

The immediate outputs of the system are confirmed ride host-rider arrangements, measured as completed trip matches with route and fuel share details. The primary deliverable is a functional web-based prototype evaluated against technical functionality, usability standards, and initial user satisfaction. Secondary outputs include system testing results and user feedback data collected during the evaluation phase.

## 3.4.4 Moderating Variables {#moderating-variables .unnumbered}

The relationship between platform features and adoption outcomes is moderated by several variables identified in the literature. Perceived risk moderates the effect of other motivations, such as environmental benefits, on students\' intention to use ride-sharing services \[34\]. Users who perceive high safety risk are less likely to respond to economic or convenience appeals until safety concerns are addressed. This moderating relationship means that the safety features of RideShareEU, specifically the verified identity display and the live trip map, must be prominent in the interface before the fuel share and match suggestions become effective motivators.

The evidence on gender is mixed. At Najran University, women were more likely to be interested in ridesharing \[35\], while at Shenzhen University sex had no significant effect on carpooling attitudes \[27\]. RideShareEU therefore offers gender-related safety options as a choice (Women+ trips) rather than assuming that all women share the same concern, and evaluates satisfaction across all respondent groups. Social norms moderate the effect of individual attitudes on behavioral intention \[52\]. Users who believe their peers carpool are more likely to act on positive individual attitudes. The trip counts and ratings shown on members' profiles are the design feature that addresses this moderating variable.

## 3.4.5 Framework Summary {#framework-summary .unnumbered}

The conceptual framework positions RideShareEU as a system that converts the institutional trust infrastructure of a university into a functional carpooling market. The university\'s verified identity records reduce the trust barrier that the literature identifies as the primary obstacle to ride-sharing adoption. The algorithmic matching engine reduces the coordination barrier. The cost display converts abstract savings into a concrete motivator. The safety features neutralize the risk perceptions that block adoption even among users who find the economic case compelling.

The evaluation phase of RideShareEU tests this through user acceptance testing of the deployed system with students, faculty, and staff and with evaluators from three university offices, focusing on match quality, interface usability, and user satisfaction within the MSEUF community.

From a software engineering traceability perspective, each IPO stage maps to a specific set of system modules and measurable outputs. The Input stage corresponds to the Authentication Module (school email verification), the Driver's License Module (license check), and the Profile Module (preference storage). The Process stage maps to the PSGA Matching Service (filter + score + rank), the Trip Day Service (confirm, start, end, and no-show handling), the Notification Service (in-app alerts, push notifications, and reminders), and the Fuel Share Calculator (cost split display). The Output stage maps to the Match Confirmation Module (approved ride with fuel share), the Rating Module (post-trip scores), and the Trust Score Module (running average update). Each module can be independently tested against a defined acceptance condition, making the conceptual framework directly traceable to the testing and evaluation procedure.

# 3.5 Definition of Terms  {#definition-of-terms .unnumbered}

**Carpool / Carpooling.** This refers to an arrangement in which two or more people share a private vehicle trip, with costs split among passengers. The vehicle is owned by one participant who would have made the trip regardless of the arrangement \[15\], \[26\], \[33\].

**Ride Sharing.** This refers to the broader practice of multiple people sharing a vehicle for overlapping trips. In this study, used interchangeably with carpooling in the context of peer-to-peer, non-commercial trip sharing \[15\], \[33\].

**Peer-to-Peer (P2P) Ride Sharing.** This refers to a ride-sharing model in which private individuals directly arrange shared trips with one another, without a professional driver or commercial vehicle. Cost sharing covers expenses only, not profit \[19\], \[26\], \[38\].

**Matching Algorithm.** This refers to a computational procedure that identifies compatible ride host and rider pairs from a pool of registered users, based on criteria such as route overlap, departure time proximity, and stated preferences. In RideShareEU, implemented as a priority-scored greedy algorithm \[4\], \[5\], \[19\], \[49\].

**Priority-Scored Greedy Algorithm.** This refers to the two-stage matching algorithm used in RideShareEU. In the first stage, it filters available trips by route overlap percentage and schedule compatibility. In the second stage, it scores and ranks the filtered candidates using stated user preferences, selecting the highest-scoring match available at the time of the request. Its greedy structure follows established greedy matching approaches \[5\].

**Fuel Share.** This refers to the voluntary contribution a passenger makes toward the ride host's fuel cost for a shared trip. It is not a fare or a commercial payment. The amount is suggested by the system from the route distance, the car's fuel efficiency, and the fuel price, divided across the seats the host offers, and is settled directly between users outside the platform. Unlike dynamic pricing \[7\], the amount is fixed per seat.

**Ride Host.** This refers to a verified university community member with a verified driver's license who posts a one-time or recurring trip on RideShareEU, offering available seats to other verified members traveling along a compatible route. Distinct from a commercial driver, the ride host earns no profit and shares only the cost of a trip they would already be making \[8\], \[26\].

**Insertion Heuristic.** This refers to an approximation algorithm for vehicle routing problems that inserts new requests into existing routes at the point of minimum additional cost, typically measured as detour distance \[5\], \[11\].

**Route Overlap.** This refers to the proportion of a passenger\'s travel path that coincides with a driver\'s planned route. A higher route overlap percentage indicates a more compatible match with lower detour cost for the driver \[3\], \[29\].

**Recurring Trip.** This refers to a trip that repeats on a defined schedule, such as a commute to campus every morning. Distinct from a single-trip request, which covers only one journey \[8\], \[14\].

**Verified Identity / Identity Verification.** This refers to a process by which a platform confirms that a registered user is who they claim to be, typically by validating credentials against an authoritative record such as a university student information system \[24\], \[25\], \[30\].

**Trust (in ride-sharing context).** This refers to a user\'s willingness to enter a shared vehicle arrangement based on confidence in the co-rider\'s identity, behavior, and the platform\'s reliability. Comprises identity trust, behavioral trust, institutional trust, and platform security trust \[15\], \[53\].

**Technology Acceptance Model (TAM).** This refers to a theoretical framework proposing that perceived usefulness and perceived ease of use are the primary determinants of a user\'s intention to adopt a new information technology \[51\].

**Theory of Planned Behavior (TPB).** This refers to a behavioral theory proposing that intention to perform a behavior is shaped by personal attitudes, subjective norms (perceptions of peer behavior), and perceived behavioral control \[52\].

**Semicentralized Matching.** This refers to a matching strategy in which the platform generates a set of compatible candidate matches and presents them to users for confirmation, rather than either assigning matches automatically or requiring users to find partners without algorithmic assistance \[21\].

**Space-Time Clustering.** This refers to a pre-processing technique that groups users by shared departure time windows and geographic proximity before applying a matching algorithm, reducing the computational cost of finding compatible pairs \[45\], \[48\].

**Meeting Point.** This refers to a designated location where a passenger boards or alights from a shared vehicle, which may differ from the passenger\'s precise home address. Meeting points are typically selected to minimize driver detour while keeping passenger walking distance acceptable. In RideShareEU, the host sets one meeting point per trip on the map \[11\], \[13\], \[22\], \[44\].

**Trip Day (Trip Run).** This refers to one day's run of a posted trip. A one-time trip has one trip day; a repeating trip has one on every day it runs. Each trip day is confirmed or skipped by the host, started, and ended separately, and is recorded as completed, skipped, or a no-show.

**Women+ Trip.** This refers to a trip that only women and non-binary riders may join, posted by a host who is a woman or non-binary. Gender in RideShareEU is self-declared and is never shown to other users.

**Driver Mode and Passenger Mode.** This refers to the two views of RideShareEU. Passenger mode centers on finding and joining rides; Driver mode centers on posting and running trips. The mode changes what the screens show, not what a user is allowed to do.

**Official Fuel Price.** This refers to the highest price per liter a host may use for the fuel share, one for each fuel type (Regular, Premium, Diesel). RideShareEU reads it from the Department of Energy's weekly price monitoring for Lucena City and administrators confirm unusual changes.

**Push Notification.** This refers to a message that the system sends to a user's phone or computer through the browser's Web Push service, so that it appears even when RideShareEU is not open.

**Optical Character Recognition (OCR).** This refers to the automatic reading of text from an image. RideShareEU uses it to compare the photo of a driver's license with the details the driver typed.

**Load Shedding.** This refers to a server answering some requests immediately with "busy, try again" when it is overloaded, instead of letting every request wait until all of them time out.

**Web Application.** This refers to a software application that runs in a web browser and is accessed over a network, without requiring installation on the user\'s device. Functionality is delivered through a combination of server-side processing and browser-rendered interfaces \[16\], \[36\].

**RESTful API.** This refers to a software architectural style for networked applications in which client and server communicate through standard HTTP methods. A RESTful API exposes system functionality as addressable resources accessible via URLs.

**Three-Tier Architecture.** This refers to a software design pattern that separates an application into three logical layers: a presentation layer that handles user interface, a business logic layer that processes operations and rules, and a data layer that manages persistent storage.

**Stable Matching.** This refers to a matching outcome in which no unmatched pair of participants would both prefer each other over their current partners. Derived from Gale-Shapley stable matching theory applied to two-sided preference markets \[49\].

**Thin Market.** This refers to a market condition in which the number of active participants is too low to generate reliable matches, resulting in frequent failures to find compatible pairs and driving users to abandon the platform. Subsidies and incentives have been proposed to attract enough participants \[38\], \[42\].

**Conceptual Framework.** This refers to a structured representation of the key concepts, variables, and relationships that define how a study\'s subject matter is understood and how the research is expected to produce its outcomes.

# 3.6 Acronyms {#acronyms .unnumbered}

The following acronyms are used throughout this thesis:

**API** -- Application Programming Interface. A set of protocols and definitions that enables software components to communicate and share data, used in RideShareEU to connect the frontend interface with the backend matching engine.

**GPS** -- Global Positioning System. A satellite-based navigation system used in RideShareEU to show the driver's position on the live trip map and, when a rider chooses to share it, the rider's position until pickup \[1\], \[30\].

**DOE** -- Department of Energy. The Philippine government agency whose weekly fuel price monitoring for Lucena City sets RideShareEU's official fuel prices.

**ICTD** -- Information and Communications Technology Department of MSEUF, one of the evaluator groups in the user acceptance test.

**IPO** -- Input-Process-Output. A systems model used in Section 3.4 to organize and present the conceptual framework, mapping the platform's inputs, processing activities, and deliverable outcomes.

**LTO** -- Land Transportation Office. The government agency that issues Philippine driver's licenses.

**OCR** -- Optical Character Recognition. Used to read the photo of a driver's license during the automatic license check.

**OTP** -- One-Time Password. The six-digit code emailed to a user's school address to confirm it at registration and password reset.

**PSGA** \-- Priority-Scored Greedy Algorithm. The two-stage matching algorithm used in RideShareEU. The first stage filters candidate trips by route overlap and schedule compatibility. The second stage ranks the filtered results by stated user preferences and selects the highest-scoring available match \[5\].

**P2P** -- Peer-to-Peer. A model in which private individuals directly arrange shared trips without a professional driver or commercial vehicle, as used throughout the RRL to describe RideShareEU's operational model \[19\], \[26\].

**REST / RESTful** -- Representational State Transfer. A software architectural style for networked applications in which client and server communicate through standard HTTP methods. Used to describe the API architecture of RideShareEU.

**SCM** -- Semicentralized Ride-Matching. A matching strategy in which the platform generates a ranked list of compatible matches and presents them to users for confirmation, preserving user autonomy while reducing search effort \[21\].

**SUS** -- System Usability Scale. A ten-item questionnaire that gives a usability score from 0 to 100, used in the user acceptance test.

**TAM** -- Technology Acceptance Model. A theoretical framework proposing that perceived usefulness and perceived ease of use are the primary determinants of a user's intention to adopt a new information technology. Applied in Section 3.2 to guide RideShareEU's interface design priorities \[51\].

**TPB** -- Theory of Planned Behavior. A behavioral theory proposing that intention to perform a behavior is shaped by personal attitudes, subjective norms, and perceived behavioral control. Applied in Section 3.2 to justify the social proof features included in RideShareEU \[52\].

**UAT** -- User Acceptance Testing. The evaluation in which members of the university community use the deployed system and answer the evaluation form.

**UI** -- User Interface. The visual and interactive elements through which users interact with a software application. Referenced throughout the study in the context of RideShareEU's design requirements for cost display, match presentation, and safety feature visibility \[16\], \[36\].

**URL** -- Uniform Resource Locator. A reference to a web resource specifying its location on a computer network. Used in the RESTful API architecture of RideShareEU to address system resources accessible through standard HTTP methods.

# Operational Framework

## Materials

### Software Requirements/ Constraints

Table I lists the software tools used to develop and deploy RideShareEU, along with the specification and purpose of each tool.

**TABLE I**

**SOFTWARE TOOLS**

| **Software** | **Specifications** | **Purpose** |
|------------|------------|--------------------------------------------|
| Figma | Version 126.0.4 | UI/UX prototyping tool used to design the interface screens before development. The prototype served as the visual specification for the first version of the frontend. |
| Visual Studio Code | Version 1.85+ | Primary code editor for writing, debugging, and testing all frontend and backend code. |
| Node.js | Version 24 | JavaScript runtime for the backend API server and the build tools. All API routes, matching logic, scheduled jobs, notification dispatch, and authentication services run on this runtime. |
| Express | Version 5 | Web framework for the RESTful API. Every write route validates its request body against a strict schema before any database write. |
| PostgreSQL | Version 17 | Relational database for user profiles, trips, trip days, matches, ratings, reports, notifications, and preferences. A relational model is required because of the structured relationships between users, trips, and matches that the matching algorithm queries. |
| Prisma ORM | Version 7 | Database toolkit that defines the schema in one file and gives the API typed, parameterized queries. |
| Next.js | Version 16 (React 19, Tailwind CSS 4) | React framework for the frontend web application. Server rendering gives fast first page loads, and client-side routing moves between screens without full page reloads. A web app manifest and service worker make it installable on phones. |
| Mapbox GL JS and Mapbox Directions | Version 3 | Interactive maps, the host's road route and travel time when a trip is posted, and turn-by-turn guidance to the pickup during a trip. |
| OpenStreetMap services (Nominatim, Photon) | Public web services | Converting typed addresses to coordinates and suggesting addresses as the user types, limited to Luzon. |
| Tesseract.js and sharp | Version 7 and 0.35 | Reading the text on a driver's license photo on the server for the automatic license check; no image leaves the system. |
| Web Push (web-push) | Version 3 | Sending phone and computer notifications through the browsers' push services, using VAPID keys. |
| Python | Version 3.10 or higher | Reference implementation of the PSGA for validation: generating the synthetic dataset, re-checking the scores with an independent implementation, comparing the PSGA with the baselines, and building the evaluators' labeling workbooks. |
| Vercel | Hobby plan, Singapore region | Cloud deployment platform for the Next.js frontend, with automatic HTTPS and continuous deployment from the Git repository. It forwards API calls to the backend. |
| Railway | Hobby plan | Cloud platform that runs the Express API and the PostgreSQL database, with a storage volume for profile photos and license photos. |
| Brevo / Resend | Email API | Sending one-time codes and account emails from the API. |
| Jest | Version 30 | JavaScript testing framework for unit and integration tests of the API, the PSGA service, the fuel share calculation, and frontend helpers. |
| Postman and Newman | Latest version | API testing. A collection of about 200 requests checks every endpoint, including authorization failures, and Newman runs it from the command line. |
| Git, GitHub, and GitHub Actions | Version 2.40+ | Version control and continuous integration. Every push runs the test suites and type checks against a fresh PostgreSQL 17 database, and a scheduled check monitors the live site every 15 minutes. |
| Sentry | Version 10 | Error monitoring for the deployed frontend. |
| Trello / Notion | Web-based | Kanban board for continuous backlog management, task assignment, and workflow tracking. |

**Technology Choice Justification:** Python and Node.js: The PSGA runs in production as a Node.js service module, so the deployed system has no cross-language service boundary, no inter-process latency, and no runtime dependency on a Python environment alongside the Node.js server. Python is used beside it as a validation environment. A Python reference implementation of the same formula generates the synthetic dataset and ranks it with the PSGA and the three baselines, and a second, independently written Python implementation re-computes every score from the stated specification; agreement between them confirms that the formula is specified and implemented correctly (Section 5.1.2.5). Keeping one runtime in production reduces deployment complexity, while the Python tools keep the algorithm testable as a standalone computational artifact.

**Software constraint:** The entire frontend must run in a standard browser without any client-side installation. This rules out desktop-only frameworks. Next.js with Vercel deployment meets this constraint for all major browsers on desktop and mobile.

### Hardware Requirements/ Constraints

Table II lists the hardware used during development and testing. Each machine handles a specific workstream to keep parallel development moving without resource conflicts.

**TABLE II**

**HARDWARE TOOLS**

| **Hardware** | **Specifications** | **Purpose** |
|------------|--------------------|------------------------------------------|
| Development Server 1 | CPU: AMD Ryzen 5 5600X RAM: 16GB DDR4 3200MHz Storage: 1TB SSD | Primary workstation for backend algorithm development and PSGA benchmarking, and for hosting the backend server during integration testing. 1TB storage accommodates larger test datasets and build artifacts. |
| Development Server 2 | CPU: AMD Ryzen 3 4100 RAM: 8GB DDR4 Storage: 256GB SSD | Secondary machine for frontend Next.js development, database schema work, and parallel image processing workflows. Dedicated to frontend tasks to avoid blocking backend development on the primary machines. |
| Development Server 3 | CPU: AMD Ryzen 3 4100 RAM: 8GB DDR4 Storage: 256GB SSD | Secondary machine for frontend Next.js development, database schema work, and parallel image processing workflows. Dedicated to frontend tasks to avoid blocking backend development on the primary machines. |
| Load-test PC | CPU: Intel Core i3-7100 (2 cores, 4 threads, 3.9 GHz) RAM: 16GB Storage: SSD | Ran the local load test: the API in production mode, its own PostgreSQL 17 database, and the load generator on one machine. Also keeps the production database backups (daily during the user acceptance test) on two physical disks. |
| Laptop 1 | CPU: Apple M4 RAM: 12GB Storage: 256GB | Portable workstation for team meetings, code reviews, and frontend testing across different viewport sizes, including macOS Safari. |
| Android phones and iPhones | Testers' own devices, current browsers | Real-device testing of the camera license photo, location sharing, push notifications, and adding the app to the home screen, which desktop browsers cannot fully reproduce. |
| Production hosting | Vercel (frontend) and Railway (API, PostgreSQL database, storage volume) | Runs the deployed system used in the user acceptance test. One API process runs the scheduled jobs in the same process. |
| Network Infrastructure | Stable internet, minimum 10 Mbps | Required for team collaboration through Git, live testing against the deployed system, and continuous deployment. Minimum 10 Mbps sustains simultaneous upload and download during active deployment cycles. |

**Hardware constraint:** The system is a web application. End users need only a device with a modern browser and an internet connection. No specific end-user hardware is mandated. The minimum 10 Mbps network constraint applies to the development team, not to end users. The value of the hardware configuration is not the individual machine specifications but the workflow separation it enables: the primary development server (AMD Ryzen 5 5600X) handles PSGA benchmarking and backend work in isolation from the frontend and integration work running on the secondary machines, reducing interference between parallel development streams. The load test ran on one of the least powerful machines, so its capacity figures are conservative.

### Data 

RideShareEU uses the following categories of data during development and operation.

**User data** is entered by each user at registration. The user enters a school email address; only addresses ending in @student.mseuf.edu.ph or @mseuf.edu.ph are accepted, and the domain sets the role (Student for the student domain; Faculty for the employee domain, since the email alone cannot tell faculty from staff). The system emails a six-digit one-time code to that address, and only a user who enters the code can continue. The user then enters a first and last name, a password, and a self-declared gender ("Prefer not to say" is an option), and may add a university ID. No data is copied from university records.

**Trip data** is user-generated. Ride hosts submit trip posts specifying origin, destination, and meeting point (chosen from address suggestions or placed on the map), departure date and time, recurrence type (one-time, daily, weekdays, or selected days), the car (make, model, color, plate number, fuel type, and fuel efficiency, usually from the host's saved cars), available seats (one to four, since more would overload a car and a van carrying paying riders can be treated as a colorum vehicle), who can join, and whether only familiar riders may join. When the trip is posted, the road route, its distance, and its travel time are obtained from Mapbox Directions and stored with the trip. Passengers submit search requests specifying origin, destination, date, preferred departure time, and flexibility window. This data is entered directly through the platform interface and stored in the relational database.

**Match data** is created when a Passenger requests to join a trip. Each record stores the trip ID, passenger ID, the PSGA score and its components at the time of the request, the approval status, the fuel share amount shown to the Passenger, an optional message to the host, and timestamps for creation and response. During a trip it also records whether the rider shares their location, their latest position until pickup, and when the driver marked them as picked up.

**Trip day data** is system-generated. Each day a trip runs gets one record with its status (confirmed, ongoing, completed, skipped, or no-show), when it was started and ended, the driver's latest position and estimated arrival while it is ongoing, and, once it ends, the number of riders and the total fuel share shown to them. Location points are kept only while they are needed: the driver's position is shown only while the trip runs, and a rider's position is erased at pickup, at the end of the trip, or after 30 minutes.

**Driver's license data** is submitted by drivers: a photo taken with the in-app camera, the license number, type, and expiry date. The photo and the full number are encrypted and kept only until the license is decided (or for seven days after an automatic approval, for an administrator's spot check); afterwards only the type, expiry, last four digits, status, and the yes/no results of the automatic check remain.

**Fuel price data** comes from the Department of Energy's weekly price monitoring for the South Luzon region. Twice a day the system reads the newest file and takes Lucena City's highest monitored price for RON 91 (Regular), RON 95 (Premium), and diesel; each applied price is stored with its source file.

**Validation dataset.** For algorithm validation, a synthetic dataset of 500 passenger-trip pairs is generated independently of the live application: 100 passenger queries, each searched against a pool of five candidate trips. Synthetic trips are constructed using origin-destination pairs drawn from the known residential clusters of MSEUF commuters along the Lucena City corridor for example, barangays such as Ibabang Dupay, Gulang-Gulang, and Ilayang Dupay as common origin zones with the MSEUF campus as the fixed destination. Departure times are distributed across the two daily peak windows: 6:00--8:30 AM (morning arrival) and 4:00--6:30 PM (afternoon departure). Route overlap values, time differentials, and preference settings are deliberately parameterized to cover the full scoring range, including edge cases such as zero route overlap, exact schedule alignment, and conflicting gender preference constraints. Ground truth labels are assigned by two human evaluators who independently classify each passenger-trip pair as an acceptable or unacceptable match using a structured rubric specifying hard rules, a schedule gap, and the extra distance the driver must travel; the evaluators see the situation (times, seats, rules, distances, and a map link) but not the algorithm's scores. Pairs where the two evaluators disagree are resolved by a third reviewer. A key limitation is that synthetic trips may not fully capture real commuting diversity, irregular schedules, multi-stop routes, and semester-to-semester variation are not represented. This limitation is acknowledged in the evaluation section.

**Preference data** is user-specified on the Profile screen. Users set which trips they see (All trips, or Women+ trips only for women and non-binary users), the departure time flexibility window in minutes, and the Familiar Riders Only toggle. Hosts choose who can join each trip they post (Anyone or Women+ only). These preferences are stored per user and applied as default parameters in all subsequent trip posts and passenger searches.

All data handling follows Republic Act 10173, the Data Privacy Act of 2012. Names, gender, trip addresses, and license numbers and photos are encrypted at rest with AES-256-GCM, passwords are stored only as bcrypt hashes, and all traffic uses HTTPS. Access to user records is restricted to authenticated sessions. No user data is shared with third parties; map, address, and email services receive only what each request needs (for example, an address to look up or the recipient of a code).

# Description of Methods or Approach

![](media/image4.png){width="6.0in" height="3.375in"}*Fig. 3. Kanban Architecture*

The Kanban board consists of four columns: **Ready**, **Development**, **Test**, and **Done**. To maintain a continuous flow of delivery, strict Work-In-Progress (WIP) limits are applied. The Development column has a WIP limit of 3, and the Test column has a WIP limit of 2. These constraints prevent bottlenecks and stop work from piling up at any single stage. The system operates on a pure pull mechanism; tasks are pulled from the Backlogs repository which holds trip module tasks, algorithm issues, UI components, and test cases into the Ready column only when the team has open capacity. Applied to RideShareEU, this methodology keeps identity verification, matching algorithm development, web application work, and API integration moving continuously, prioritizing cycle time reduction over the administrative overhead of batched releases or fixed sprints.

.

### Requirements Definition

*5.1.4 Data Analysis and Coding Method*

**Identity verification.** At registration, the system accepts only school email addresses and emails a six-digit one-time code to the address. The code is stored only as a hash, expires, and allows a limited number of attempts, and sign-up attempts are rate-limited. Only a user who enters the correct code can finish creating an account. The role (Student or Faculty) is taken from the email domain. Drivers are verified a second time through their driver's license before they can post a trip.

**Trip data coding.** Each trip record stores host user ID, origin, destination, and meeting point coordinates, the road route as a list of waypoints with its distance and duration, departure time, recurrence type and days, total seat count, filled seat count, the car, who can join, the familiar-riders rule, the fuel share per seat, and trip status (open, full, cancelled, or completed). Each day the trip runs is coded separately as a trip day. Route overlap between a trip and a passenger request is computed using the passenger's origin and destination and the host's route waypoints.

**Match scoring.** The PSGA produces a numeric score for each candidate trip as a weighted sum of route overlap percentage, schedule alignment accuracy, and preference compatibility. Route overlap is the proportion of the passenger route covered by the host route. Schedule alignment is derived from the absolute time difference normalized against the flexibility window. Preference compatibility checks seats, the trip's Women+ rule, the passenger's Women+ trips only choice, and the familiar-riders-only setting. A trip must also go in the passenger's direction: the driver must reach the pickup before the drop-off.

**Rating and trust.** After each completed trip (or each driven day of a repeating trip), the riders rate the driver and the driver rates the riders, from 1 to 5. The system updates each user's cumulative trust score using a running average across all received ratings. The score and total trip count display on the public profile.

**Coding approach.** The backend API uses Express on Node.js with a RESTful architecture. Each resource has dedicated endpoint groups. Every route except sign-in and sign-up requires a valid session token. Every write request is checked against a strict schema before any database write: unknown fields, wrong types, and fields a client may never set (such as the user ID or the fuel share) are rejected. The PSGA matching logic, the rider eligibility rules, and the trip day timing rules are isolated in dedicated service modules with no database access, separately unit-tested from the API layer. The frontend uses Next.js with server components for data loading and client components for interaction. All inter-tier communication uses JSON over HTTPS.

### Functional Requirements

1\. Verified university member registration using a school email address confirmed with an emailed one-time code.

2\. Driver's license verification before posting a trip: a camera photo, an automatic consistency check, and administrator review.

3\. A Passenger mode and a Driver mode, each showing the screens and notifications for that role.

4\. Trip posting by ride hosts with origin, destination, meeting point, departure time, recurrence pattern, car, seat count, and who can join, with saved cars and a map route preview.

5\. Trip search and join requests from passengers with compatible route and schedule parameters, with a "show all trips" view when nothing matches.

6\. A priority-scored greedy algorithm that filters trips by eligibility, date, direction, route overlap, and time window, then ranks filtered results by route overlap weight, schedule alignment weight, and preference compatibility weight.

7\. Host approval or decline of join requests, with checks that no user is booked on two trips at the same time.

8\. A daily trip lifecycle: confirm or skip a trip day, start the trip, mark riders as picked up, end the trip, and handle drivers who do not start.

9\. A live trip map showing the driver's position and estimated arrival to approved riders, optional rider location sharing until pickup, and directions for the driver.

10\. A trip chat between the host and approved riders.

11\. A notification system with in-app alerts and phone push notifications for requests, approvals, cancellations, trip starts, messages, reminders, and rating prompts.

12\. A trust and rating system where both parties rate each other after a completed trip.

13\. A fuel share display showing the suggested per-seat contribution for each trip, using a fuel price capped by the official DOE-based price.

14\. Safety and support features: reports with an automatic suspension ladder, official warnings, a Help page with emergency guidance, and requests to administrators.

15\. Administrator functions: report and license review, warnings, suspensions, trip cancellation, fuel prices, announcements, monitoring, and an audit log; a single superadmin appoints administrators and handles lawful data requests.

16\. Account deletion that anonymizes the user's records.

17\. A driver summary of completed rides, riders, and fuel share shown.

### Non-functional Requirements

1\. Match generation response time is less than two seconds; at least 95% of all requests complete within two seconds with 200 simultaneous users.

2\. Secure handling of university identity data in compliance with Republic Act 10173.

3\. A mobile-responsive web interface is accessible through any modern browser without installation.

4\. System availability of at least 99% during academic term periods, checked by an automated health check every 15 minutes.

5\. Protection against the OWASP Top 10 risks, including rate limits on sign-in, sign-up, and per account, and refusal of requests that try to act on another user's data.

The functional and non-functional requirements above are derived from three sources: the stakeholder needs analysis conducted with prospective MSEUF users, the literature-identified minimum feature set for campus carpooling systems (Sections 3.3.1--3.3.2), and the ISO/IEC 25010 quality model applied to web-based systems. Each requirement is stated in testable form it specifies what the system must do or achieve, not how it is implemented allowing each requirement to be independently verified during the testing phase in Section 5.1.5.

**5.1.3.1 Requirements Traceability Matrix**

To ensure rigorous software engineering validation, the system\'s functional requirements are mapped directly to their corresponding software modules, API endpoints, and ISO/IEC

25010 evaluation metrics.

| **Requirement ID** | **Use Case / Module** | **Target API Endpoint** | **ISO 25010 Metric** |
|---------------|---------------|-------------------|---------------|
| FR1: Verified Registration | Register with school email | POST /api/auth/register/start, /register/verify-otp, /register/complete | Security |
| FR2: License Verification | Submit and review driver's license | POST /api/users/me/license; POST /api/admin/licenses/:id/approve | Security |
| FR4: Trip Posting | Manage Trips (Host) | POST /api/trips | Functional Suitability |
| FR6: PSGA Algorithm | Run PSGA Engine | POST /api/matches/search | Performance Efficiency |
| FR7: Join and Approval | Request to join; approve or decline | POST /api/matches; PATCH /api/matches/:id | Functional Suitability |
| FR8: Trip Day Lifecycle | Confirm, start, end a trip day | POST /api/trips/:id/days/:date/confirm, /start, /end | Reliability |
| FR9: Live Trip Map | Share and view location | POST and GET /api/trips/:id/location | Usability |
| FR11: Notifications | Send Notification | GET /api/alerts/feed; POST /api/push/subscriptions | Usability |
| FR12: Ratings | Rate after a trip | POST /api/matches/:id/ratings | Functional Suitability |
| FR14: Reports | Report a user | POST /api/reports | Security |

### 5.1.4 Design Architecture of the System {#design-architecture-of-the-system .unnumbered}

RideShareEU uses a three-tier architecture. The presentation layer runs on Next.js 16. The business logic layer is an Express API server on Node.js handling matching, identity and license verification, the trip day lifecycle, notification dispatch, and fuel share computation, together with scheduled jobs that run every few minutes (trip day steps, reminders, push delivery, location clean-up) and daily jobs (fuel prices, license expiry reminders). The data layer is a PostgreSQL database, accessed through Prisma, storing users, trips, trip days, matches, ratings, licenses, reports, notifications, and preferences. Module decoupling is a key architectural concern. The PSGA engine is isolated as a dedicated service module with a strictly defined input contract: it accepts a passenger search request object and a list of candidate trip records and returns a ranked list of scored matches. It has no direct dependency on the HTTP routing layer, the database connection pool, or the notification service. This isolation means the PSGA can be unit-tested completely independently from the rest of the system, updated or replaced without touching the API layer, and re-implemented in a different language without requiring changes to any surrounding module. The API layer loads the candidate trips from the database and calls the PSGA service as an internal function call. The UI layer never directly invokes matching logic. This separation of concerns is enforced as an architectural rule throughout development.

*5.1.2.1 Class Diagram*![](figures/fig04-class.png){width="6.3in"}

*Fig. 4 Class Diagram*

The class diagram defines the core classes. User is the central entity storing identity, role, mode, and trust rating. Trip is owned by a User acting as host and holds all route, schedule, and vehicle attributes. TripRun records one day's run of a Trip with its status, start and end times, and the driver's latest position. Match links a Trip to a passenger User and records the PSGA score, status, fuel share, and the rider's pickup details. Notification associates with a User and carries alert type and read status. Preference is a one-to-one extension of User storing default matching settings. Rating links to a completed Match and records rater, ratee, and score. Vehicle stores the car of each trip, and SavedVehicle the host's list of cars. DriverLicense stores each license submission and its decision. Message holds the trip chat, Report the reports filed against users, and AdminAction the audit log. PSGA is a service class with filter, score, and rank methods.

*5.1.2.2 Use Case Diagram*

![](figures/fig05-usecase.png){width="5.6in"}*Fig. 5 Use Case Diagram*

Two primary actors interact with the system: a university member as Ride Host (Driver mode) and a university member as Passenger (Passenger mode). An Administrator moderates the platform, and a System actor represents automated processes. Both host and passenger share the Register use case, which includes school email verification as a dependency. The host covers submitting a driver's license, posting trips, managing trips, approving or declining join requests, confirming or skipping trip days, starting and ending trips, marking riders as picked up, rating passengers, and viewing notifications. The passenger covers searching for rides, submitting join requests, viewing match details with fuel share, following the trip on the live map, sharing their location, chatting, and rating hosts. The Administrator covers reviewing reports and licenses, issuing warnings and suspensions, cancelling trips, and confirming fuel prices. The System actor drives the PSGA engine, the automatic license check, the trip day steps, fuel price imports, and notification dispatch, which other use cases trigger as includes.

*5.1.2.3 Sequence Diagram*

![](figures/fig06-sequence.png){width="6.0in"}

*Fig. 6 Sequence Diagram*

The sequence diagram covers three phases. In Trip Search and Matching, the passenger submits a search through the frontend, the API loads the candidate trips from the database and passes them to the PSGA engine, the PSGA returns ranked matches, and the frontend displays results. In Join Request and Approval, the passenger submits a join request, the API creates a match record and notifies the host, the host approves, and the API updates the match status and notifies the passenger with fuel share details. In Post-Trip Rating, the passenger submits a rating, the API saves it and updates the host trust score, and the frontend displays the updated score.

*5.1.2.4 Activity Diagram*

![](figures/fig07-activity.png){width="3.6in"}

*Fig. 7 Activity Diagram*

The activity diagram traces the full user journey. The user opens RideShareEU. If not registered, the flow goes to institutional email registration. After login, the flow splits by role. Hosts post a trip, receive a join request notification, and approve or decline. Passengers search for rides, view ranked PSGA matches, and submit a join request. Both branches merge at the trip day. The evening before, the host confirms or skips the day. At departure the host starts the trip, riders follow the car on the live map, and the host marks each rider as picked up. The host ends the trip at the destination (or the system ends it when the host's phone arrives at campus, or an hour after the planned arrival). The system marks the day as completed, sends rating prompts, both parties submit ratings, and trust scores update. If the host does not start within an hour of departure, the day is recorded as a no-show and the riders are told to find another ride.

*5.1.2.5 Algorithm*

![](figures/fig08-psga.png){width="6.0in"}

Fig. 8 Priority-Scored Greedy Algorithm (PSGA)

The PSGA is a two-stage greedy algorithm. It selects the best available trip for a Passenger request at the time of the request without revisiting earlier decisions. This greedy structure fits the RideShareEU context for two reasons. First, university commutes are scheduled in advance. The trip pool at any query time is fully observable, not dynamically arriving. Second, the community is bounded. The university population is finite, which keeps the candidate set tractable for real-time matching within a two-second response constraint.

Other approaches in the literature optimize the allocation as a whole: multi-objective planning of commuter carpooling \[18\], combinatorial auctions for student ridesharing \[39\], two-sided stable matching \[49\], and learning-based matching that pursues fairness or lower emissions \[23\], \[31\]. These methods can produce better global allocations, but they require collecting requests into batches, solving larger optimization problems, or training a model on past data, which a newly launched campus platform does not have. A globally optimal matching approach, such as the stable roommates or Hungarian algorithm, would require holding requests in a queue and solving a batch assignment across all pending passengers simultaneously. This is unsuitable for a platform where Ride Hosts post trips on their own schedules and Passengers search independently. The greedy approach provides immediate results with deterministic behavior. A Passenger submits a request and receives a ranked list of matches in a single operation. It is important to be precise about what the PSGA claims and does not claim. It does not assert global optimality it does not guarantee that the simultaneous assignment of all passengers across all available trips at any given moment is the mathematically best possible allocation. Proving global optimality would require a batch assignment formulation such as the Hungarian algorithm or stable matching, which requires holding all passenger requests in a queue and solving them together. This is unsuitable for an asynchronous platform where hosts post trips and passengers search independently at different times. The PSGA claims practical suitability: for a bounded, fully observable trip pool with independent per-passenger queries, greedy selection with a weighted composite score is fast, deterministic, and produces results validated against a human-labeled ground truth and three baselines. The distinction between practical suitability and global optimality is maintained precisely throughout this manuscript.

**How the Algorithm Works**

## Stage 1: Filtering {#stage-1-filtering .unnumbered}

The filter stage removes candidate trips that cannot satisfy the Passenger\'s basic requirements. Before any predicate is computed, the candidate pool is narrowed to the trips the Passenger could actually take: open trips with a free seat, not hosted by the Passenger, that run on the Passenger\'s chosen date and whose host has not skipped that day, and that the Passenger may join under the trip\'s rules (a Women+ trip only for women and non-binary riders, a familiar-riders-only trip only for riders who have completed a ride with that host) and the Passenger\'s own "Women+ trips only" choice. These eligibility facts are read from the database, never from the request. Because an ineligible trip never reaches scoring, its route and schedule are never revealed to that Passenger. The filter stage then applies three predicates in sequence. A trip must pass all three to advance.

**Filter 1: Route Overlap.** The system computes the geographic overlap between the Passenger\'s origin-to-destination route and each Open trip\'s host route. Overlap is measured as the proportion of the Passenger\'s path that falls within a tolerance corridor of the host\'s path. Formally:

RouteOverlap(P, H) = \|segment(P) intersect corridor(H)\| / \|segment(P)\|

Any trip with RouteOverlap below the minimum threshold is discarded. The threshold is a system parameter, set to 0.40 (40% of the Passenger\'s path), with a corridor of 1,500 meters around the host\'s route; the corridor was widened from 500 meters because free geocoding often places a typed address one to two kilometers from the intended spot. Setting it too high eliminates valid near-route matches. Setting it too low introduces trips that require the Passenger to travel significantly out of direction.

**Filter 2: Schedule Compatibility.** The system computes the absolute time difference between the Passenger\'s preferred departure time and the host trip\'s scheduled departure time. Any trip whose time difference exceeds the Passenger\'s stated flexibility window in minutes is discarded. Formally:

TimeDiff(P, H) = \|DepartureTime(P) - DepartureTime(H)\| \<= FlexWindow(P)

The flexibility window is a user-set preference stored in the Passenger\'s profile. The default is 15 minutes. Users adjust it on the Profile screen or in the search form.

**Filter 3: Direction.** Route overlap alone ignores direction, so a trip driving the same road the opposite way would score as fully overlapping. The system therefore finds the point on the host\'s route nearest to the Passenger\'s pickup and the point nearest to the drop-off, and keeps the trip only if the driver reaches the pickup first. Formally:

Along(H, pickup(P)) \< Along(H, dropoff(P))

where Along is the distance traveled along the host\'s route to its nearest point.

## Stage 2: Scoring {#stage-2-scoring .unnumbered}

Each trip that passes both filters receives a composite score. The score is a weighted sum of three components, each normalized to the range \[0, 1\].

Score(P, H) = (w1 x RouteOverlap) + (w2 x ScheduleAlignment) + (w3 x PreferenceMatch)

**RouteOverlap.** The value computed in Stage 1, expressed as a decimal from 0.0 to 1.0. A RouteOverlap of 1.0 means the Passenger\'s full path is covered by the host route.

**ScheduleAlignment.** Computed as 1 minus the normalized time difference within the flexibility window. A time difference of 0 minutes produces a ScheduleAlignment of 1.0. A time difference equal to the full flexibility window produces a ScheduleAlignment of 0.0. Formally:

ScheduleAlignment = 1 - (TimeDiff / FlexWindow)

**PreferenceMatch.** A binary value. It is 1.0 if all hard preference constraints are satisfied and 0.0 if any single constraint fails. Hard constraints include: the trip's Women+ rule (a Women+ trip accepts only women and non-binary riders), the passenger's Women+ trips only choice, the Familiar Riders Only toggle, and available seat count being greater than zero. PreferenceMatch is evaluated as a conjunction. All constraints must pass for the value to be 1.0. In the implementation these constraints are also applied as a pre-filter before scoring, so for every trip shown to a passenger the preference term is met.

The weights w1, w2, and w3 are system parameters that sum to 1. Default values are set at w1=0.5, w2=0.3, w3=0.2, reflecting that geographic compatibility is the primary matching criterion for recurring campus commutes. The deployed system uses these defaults; they are kept in one configuration file so that a different weight set can be evaluated against the human-labeled ground truth without changing the algorithm.

Baseline Comparison Justification

The PSGA is evaluated against three simpler baseline approaches to demonstrate its comparative value over readily available alternatives.

Baseline 1 Random Ranking: Trips that pass Stage 1 filtering are presented in random order with no scoring applied. This is the lowest-effort implementation and establishes the floor for match acceptance rate.

Baseline 2 Route-Only Matching: Trips are filtered and ranked by route overlap percentage alone, ignoring schedule alignment and user preferences. This tests whether the additional scoring dimensions of the PSGA contribute meaningful improvement over pure geographic proximity matching.

Baseline 3 FIFO Listing: Trips are presented in the order they were posted, with no filtering or scoring. This represents the default behavior of an unranked trip board and is the most common pattern in general-purpose ride boards.

The PSGA is expected to outperform all three baselines on precision at rank 1 meaning the top result shown to the passenger is more frequently an acceptable match. The validation phase in Section 5.1.2.5 measures and reports this comparison explicitly.

## Ranking and Output {#ranking-and-output .unnumbered}

All scored candidates sort in descending order by Score. The top-ranked trip is presented first. Each result shows its departure time, how far it is from the Passenger\'s preferred time (for example, "Leaves 9 min after your 6:15 AM"), the match percentage, seats left, the fuel share per seat, the trip\'s rule badges, and a "How is this worked out?" explanation of the score. If no trips pass Stage 1, the system shows an empty state with a "Show all trips" option.

**Show all trips.** This fallback relaxes only the route-overlap threshold and the departure-time window. It keeps every eligibility rule and anchors on the destination: a trip is listed only if it ends within 3 kilometers of the Passenger\'s destination, or if its route passes the destination after the pickup (for a rider getting off on the way). The listed trips are scored with the same formula so that their percentages are comparable.

The entire two-stage operation runs in memory after one database query. The candidate trips are retrieved once, narrowed by the eligibility rules, then filtered and scored in one pass. This O(n) time complexity per query, where n is the number of open trips, satisfies the two-second response requirement for the bounded university community population. For a university of 10,000 registered users with an estimated concurrent trip pool of 200 to 500 open trips, the match operation completes in well under one second on standard server hardware.

## Algorithm Pseudocode {#algorithm-pseudocode .unnumbered}

FUNCTION PSGA(passenger_request):

> candidates \<- GET all trips WHERE status=Open AND host != passenger
>
> // Eligibility pre-filter
>
> candidates \<- candidates WHERE runsOn(trip, request.date) AND NOT skipped(trip, request.date) AND seats\>0 AND riderMayJoin(passenger, trip)
>
> // Stage 1: Filter
>
> filtered \<- \[\]
>
> FOR EACH trip IN candidates:
>
> overlap \<- computeRouteOverlap(passenger_request, trip)
>
> timeDiff \<- \|passenger_request.departure - trip.departure\|
>
> IF overlap \>= MIN_OVERLAP AND timeDiff \<= passenger_request.flexWindow AND goesRiderWay(passenger_request, trip):
>
> filtered.append(trip)
>
> IF filtered is empty: RETURN no_match // the user may then choose Show all trips
>
> // Stage 2: Score
>
> FOR EACH trip IN filtered:
>
> routeScore \<- computeRouteOverlap(passenger_request, trip)
>
> schedScore \<- 1 - (\|departure_diff\| / flexWindow)
>
> prefScore \<- checkPreferences(passenger_request, trip)
>
> trip.score \<- (w1\*routeScore) + (w2\*schedScore) + (w3\*prefScore)
>
> // Rank and return
>
> RETURN sorted(filtered, by=score, descending=True)

## Fuel Share Calculation {#fuel-share-calculation .unnumbered}

The fuel share is a fixed, per-seat suggested contribution. It is computed when the Ride Host posts the trip and stored with the trip record. It is a separate function from the PSGA and does not affect matching or ranking.

FuelShare = (DistanceKm / FuelEfficiency) x FuelPricePerLiter / SeatsOffered

DistanceKm is the driving distance of the host's full route, obtained from the Mapbox Directions API when the trip is posted. FuelEfficiency is drawn from the vehicle record submitted by the Ride Host. FuelPricePerLiter is entered by the Ride Host for each trip, reflecting the pump price they actually paid. It may not exceed the official price per liter for the vehicle's fuel type (Regular, Premium, or Diesel, recorded with each vehicle), which prevents hosts from overcharging. The official prices come from the Department of Energy's weekly fuel price monitoring: every day at 10:00 AM and 3:00 PM the system reads the newest Region IV-A file and takes Lucena City's highest monitored price for RON 91 (Regular), RON 95 (Premium), and diesel. A change of 15% or less is applied automatically; a larger change, or a file that cannot be read, is held and every administrator is notified to apply or dismiss it, and administrators can still set a price by hand. When no official price exists for a fuel type, the system rejects values outside PHP 20 to PHP 150 per liter to catch typing errors. The form pre-fills the official price, and a host may enter a lower one. SeatsOffered is the number of passenger seats the host makes available. The driver is not counted, since the trip and vehicle are the host's own.

Because the formula does not depend on how many seats are filled, the figure does not change as seats fill, and every Passenger sees the same amount. This follows the fixed-price-per-seat model used by BlaBlaCar. If the host edits the route, seat count, or vehicle before any Passenger has been approved, the figure is recalculated; once the first Passenger is approved, it is locked. When a Passenger requests to join, the current amount is also recorded on their request, so a later edit by the host never changes what an already-joined Passenger was shown. If the route distance, fuel efficiency, or fuel price is unavailable, no suggested amount is displayed. The figure is informational. Payment is arranged directly between the parties outside the platform.

## Complexity and Performance Targets {#complexity-and-performance-targets .unnumbered}

**TABLE III**

| **Metric** | **Target** | **Basis and measured result** |
|--------------|--------------|----------------------------------|
| Time complexity per query | O(n) where n = open trips | Single-pass filter and score over the eligible candidate set |
| Match generation time | \< 2 seconds | Non-functional requirement; in the load test, 95% of all requests (searches included) finished within 73 ms at 200 simultaneous users and within 0.7 s at 600 |
| Concurrent users | At least 200 simultaneous users | Estimated peak load at class schedule transitions; one API process served about 600 simultaneous users without errors, and past that answered "busy, try again" instead of failing |
| Score precision | 4 decimal places | Sufficient to rank candidates with near-equal scores |

## Algorithm Validation {#algorithm-validation .unnumbered}

The PSGA is validated separately from the web application using a synthetic dataset of 500 passenger-trip pairs drawn from address clusters around Enverga University in Lucena City: 100 passenger queries, each with a pool of five candidate trips. The dataset spans route distance ranges, departure time distributions, and preference combinations representative of a university commute population. Evaluation metrics are precision at rank 1 (proportion of top-ranked matches that are ground truth positives), recall across the full filtered set, and mean rank of the first acceptable match.

Two checks that need no human labels have been completed. First, the scoring formula was restated as an exact specification and implemented a second time, independently, in Python; it agreed with the reference implementation on all 500 pairs for route overlap, schedule alignment, preference match, and score. Building this check exposed and fixed a stale 500-meter corridor in the reference implementation. Second, each method\'s top result was compared on facts the dataset records. The PSGA\'s top result satisfied every hard rule and fell inside the route and time filter in all 100 queries, 2.5 minutes from the preferred time on average. The route-only and random baselines ranked a trip the passenger was not allowed to join first in 55 and 43 queries, and FIFO did so in 49 queries and ranked a trip outside the route or time filter first in another 36. Because the baselines depend on the order in which trips were posted, the comparison was repeated over 200 shuffled posting orders, with the same conclusion (the PSGA top result usable in 100 queries, against 59 for route-only and random and 43 for FIFO on average). This comparison is partly true by construction: the PSGA removes trips that break a hard rule before ranking, and the baselines do not. It shows the value of applying the hard rules as filters, not the quality of the ranking among acceptable trips, which is what precision at rank 1 against the human ground truth measures.

The ground truth oracle is defined as follows: for each of the 500 passenger-trip pairs in the synthetic dataset, two human evaluators independently assess whether the pair constitutes an acceptable match based on the stated route, schedule, and preference parameters. A pair is labeled a ground truth positive only if both evaluators agree it is acceptable. Disagreements are resolved by a third evaluator acting as tiebreaker. Evaluators are given a structured rubric specifying the hard rules, a time rule (a gap within the passenger\'s flexibility window is acceptable, up to 10 minutes beyond it is left to judgment), and a route rule on the extra distance the driver travels to pick the passenger up (up to 1 kilometer is acceptable, 1 to 3 kilometers is left to judgment), to minimize subjective variation. The evaluators work in separate workbooks that list the pairs in different orders and do not show the algorithm\'s scores, so the ground truth cannot simply echo the PSGA. This oracle definition is fully documented and reproducible, allowing future researchers to re-evaluate the PSGA against the same ground truth using different scoring weights. Results are reported alongside the ISO/IEC 25010 system evaluation and the three-baseline comparison described in the preceding section.

# B. Description of Methods or Approach {#b.-description-of-methods-or-approach .unnumbered}

## Development Methodology {#development-methodology .unnumbered}

RideShareEU follows a Kanban software development methodology. Kanban employs a continuous pull system. This system supports parallel workstreams better than fixed length iterations.

The board divides tasks into Ready, Development, Testing, and Done. The framework applies Work In Progress limits. These limits prevent bottlenecks between algorithmic validation, backend API construction, and frontend UI design. They support the integration of user profile and notification screens.

The methodology organizes the pull system across six artifact categories. The categories include literature and requirements, architecture and design, PSGA prototype, API integration, frontend components, and test cases.

Work In Progress limits act as an engineering control. They stop the algorithm development stream from blocking API integration. They prevent incomplete frontend components from entering the testing phase before API endpoint verification.

This delivery model lets the team validate the PSGA engine in isolation. The team integrates engineering improvements without blocking presentation layer development. Examples include refining the PSGA service interface, tightening API input validation, and adding test coverage for edge cases.

## Data Gathering Procedure {#data-gathering-procedure .unnumbered}

The study gathers five kinds of data. For each, the procedure below states its source, how it is collected, where it is stored, who can access it, and when it is deleted. All of it is handled under Republic Act 10173 and the MSEUF institutional policy on research data management, and no data is taken from university records.

1\. **Application data from the deployed system.** During the user acceptance test, participants create test accounts with their school email and use the app. The data they enter (account details, trips, requests, messages, ratings, reports, and, for drivers, license submissions) is stored in the system\'s PostgreSQL database on Railway, with names, gender, addresses, and license numbers and photos encrypted. Only the research team, acting as administrators, can access it, within the limits described in the Ethics Consideration (administrators cannot read trip chats or see live locations). For the thesis, only counts and totals are extracted (for example, trips posted, requests approved, and riders per completed trip); no individual\'s records are reported. Test accounts and trips are deleted after the evaluation period.

2\. **Evaluation responses.** Participants answer an anonymous Google Form after testing. The form begins with an informed consent question, and a participant who does not consent is taken to the end of the form. It does not collect names or email addresses, only the respondent group, age range, how the app was used, the device, and the ratings and comments. Responses are stored in a Google Sheet owned by the research team\'s account and shared with no one outside the team. They are analyzed only as group results and kept until the thesis is completed.

3\. **Algorithm validation data.** The 500 passenger-trip pairs are synthetic: they are generated by a script with a fixed random seed from public anchor locations around Lucena City and contain no real person\'s data. Two human evaluators who did not build the application label each pair as acceptable or not in separate workbooks, and a third evaluator settles disagreements. The evaluators\' names and roles are recorded for the methodology; their judgments are stored with the dataset in the project repository.

4\. **Performance data.** The load test runs on the researchers\' own computer against a separate test database filled with generated accounts and trips. It records only response times, error rates, and resource use.

5\. **Public reference data.** Official fuel prices are read from the Department of Energy\'s published weekly price monitoring; maps, routes, and place names come from Mapbox and OpenStreetMap under their terms of use, with the attribution they require. These are legitimate public sources and contain no personal data.

Backups of the production database are made through an encrypted connection and kept on two physical disks under the research team\'s control. When the study ends, the remaining application data is deleted, and only the anonymous survey results and aggregate figures are kept for the thesis.

### **a. Comprehensive Discussion on Theorems and Definitions** {#a.-comprehensive-discussion-on-theorems-and-definitions .unnumbered}

The theoretical foundation of the PSGA draws from two bodies of work: greedy algorithm theory and carpool matching formulations.

A greedy algorithm makes the locally optimal choice at each step without backtracking. For carpool matching, this means selecting the highest-scoring available trip at query time rather than holding requests in a queue for batch optimization. The correctness condition for a greedy approach applies when the local optimum at each step does not prevent a globally acceptable solution. In a bounded university community where trips are posted in advance and Passengers search independently, each query is independent. The greedy choice for one Passenger does not block a valid match for another Passenger asking for a different route. A Passenger may send requests to several hosts at once; when one host approves, the Passenger\'s other pending requests at an overlapping time are withdrawn in the same database transaction, and a Passenger who is already booked at that time cannot be approved again, so the asynchronous greedy choices never double-book a rider.

The route overlap computation draws from computational geometry. The segment intersection method used by PSGA computes whether a Passenger\'s origin-to-destination path falls within a tolerance corridor of the host route, using great-circle (Haversine) distances between sampled points. This approach is a simplification of full map-matching but sufficient for the scale of a single university campus and its surrounding residential clusters.

### **b. Fundamental Algorithms** {#b.-fundamental-algorithms .unnumbered}

The PSGA is implemented in two stages as described in Section 5.1.2.5. The following supporting algorithms are used within the system.

**Route Overlap Computation.** The host route is the road geometry returned by the Mapbox Directions API when the trip is posted, stored as a list of waypoints; the Passenger route is approximated as the straight segment from origin to destination, sampled at 21 evenly spaced points. Overlap is computed as the fraction of those sample points that fall within a 1,500-meter corridor of the host route, where each point's distance to the host route is measured with the Haversine formula. This replaces a full polygon intersection approach, which is computationally heavier and unnecessary at the scale of city-level driving routes. If a trip has no stored road geometry, the straight line from its origin to its destination is used instead.

**Direction Check.** For the Passenger\'s pickup and drop-off, the system walks along the host\'s route and records how far along the route the nearest point lies. The trip goes the Passenger\'s way only if the pickup\'s position comes before the drop-off\'s. The same measure decides whether a route passes the Passenger\'s destination after the pickup in the Show all view.

**Schedule Conflict Rule.** Two trips clash when they run on a common Philippine calendar day (from their dates, recurrence types, or shared weekdays) and their time spans overlap, where a span runs from the departure time for the trip\'s travel time (60 minutes when unknown); back-to-back trips do not clash. The rule is applied when a Passenger requests a trip, when a host posts or reschedules a trip, and when a host approves a rider.

**Trip Day Timing.** Carpooling models that account for driver absence show that a driver who does not come affects every rider assigned to them \[20\]; RideShareEU therefore checks each trip day in advance and handles a missing driver explicitly. For each trip day the system applies fixed steps: at 8:00 PM the evening before, the host is asked to confirm the day (only when riders are waiting); 60 minutes before departure, approved riders are warned if the host has not confirmed; 15 minutes after departure without a start, riders are told the driver is late; and 60 minutes after departure without a start, the day is recorded as a no-show. A trip can be started from 30 minutes before to 60 minutes after its departure, and a started trip ends when the host taps End Trip, when the host\'s phone is within 150 meters of campus, or automatically 60 minutes after the planned arrival. Riders are notified once when the driver comes within 1 kilometer of the pickup point.

**License Consistency Check.** The license photo is normalized and read with optical character recognition. The text must contain Land Transportation Office license wording, every part of the account name (allowing one misread letter in names of four or more letters and two in names of eight or more), the license number, and the expiry date, allowing for common letter and digit confusions. A license that passes every check is approved automatically; any other is left for an administrator, who sees which checks failed.

**Fuel Share Calculation.** A direct arithmetic formula computes the per-passenger fuel contribution as described in Section 5.1.2.5. No machine learning or optimization is involved. The inputs are the host\'s route distance, the vehicle fuel efficiency from the host\'s vehicle record, the host-entered fuel price for that trip, and the number of passenger seats offered. It is computed when the trip is posted, and recalculated only if the host edits the route, seats, or vehicle before any Passenger has been approved.

**Trust Score Update.** After each completed trip, both the Ride Host and the Passenger submit a rating from 1 to 5. The system updates each user\'s cumulative trust score as a running average over all received ratings. The formula is: TrustScore = (PreviousAverage x TripCount + NewRating) / (TripCount + 1). This avoids recomputing the average over all stored ratings each time a profile is read.

### **c. Mathematical Models and Formulas** {#c.-mathematical-models-and-formulas .unnumbered}

The core mathematical model of the system is the PSGA scoring formula. The complete set of formulas used in the system are documented below for reference.

**TABLE IV**

| **Variable** | **Formula** | **Output Range** |
|--------------|------------------------------------|--------------|
| RouteOverlap | Sample points of the passenger route within 1,500 m of the host route / 21 sample points | \[0, 1\] |
| ScheduleAlignment | 1 - (\|departure_diff\| / flex_window) | \[0, 1\] |
| PreferenceMatch | 1 if all hard constraints pass, 0 otherwise | {0, 1} |
| Direction | Along(host route, pickup) \< Along(host route, drop-off) | true / false |
| PSGA Score | (w1 x RouteOverlap) + (w2 x ScheduleAlignment) + (w3 x PreferenceMatch), with w1 = 0.5, w2 = 0.3, w3 = 0.2 | \[0, 1\] |
| FuelShare (PHP) | (DistanceKm / FuelEfficiency) x min(FuelPricePerLiter, OfficialPrice) / SeatsOffered | PHP \> 0 |
| TrustScore | (PrevAvg x TripCount + NewRating) / (TripCount + 1) | \[1, 5\] |
| ScheduleConflict | sameDay(A, B) AND startA \< endB AND startB \< endA | true / false |
| SUS score | ((sum of odd items - 5) + (25 - sum of even items)) x 2.5 | \[0, 100\] |

## Design Phases of the Study {#design-phases-of-the-study .unnumbered}

### **a. Data Pre-Processing Techniques** {#a.-data-pre-processing-techniques .unnumbered}

Trip data submitted by users contains free-text origin and destination entries. As the user types, the address field suggests up to five places from the Photon service (OpenStreetMap data), limited to Luzon and ranked toward Lucena City; picking a suggestion sets the exact coordinates. Text typed without picking a suggestion is looked up once, when the user leaves the field, with the Nominatim geocoding service (OpenStreetMap data), which also produces a standardized latitude-longitude coordinate pair; Nominatim is never called on every keystroke, as its usage policy requires, and its results are cached and spaced at least 1.1 seconds apart. Places outside Luzon are rejected. Because geocoded addresses in the Philippines often resolve to a town center or street rather than the exact house or gate, users can then drag the pin on the map to their exact spot, or use their device's current location, and those coordinates replace the geocoded ones. This normalization step ensures that route overlap computation operates on consistent geographic primitives regardless of how the user typed the address.

Departure time entries are stored in UTC and converted to Philippine Standard Time (UTC+8) at display. All time arithmetic in the PSGA operates in UTC to avoid conversion errors during schedule comparison. Recurring trips are handled in two steps rather than by generating a list of future departures. First, a date-eligibility check keeps only the trips that actually run on the Passenger's chosen date: a one-time trip must fall on that exact date, a daily trip runs every day, a weekday trip runs Monday to Friday, and a custom trip runs only on the days of the week the host selected. A recurring trip is only eligible from its first departure date onward. The day is determined in Philippine local time, so a 7:00 AM departure (stored as 11:00 PM UTC the previous day) is counted on the correct calendar day. Second, the filter and scoring stages compare the departure time of day for the trips that remain. Because every remaining trip already runs on the Passenger's chosen date, comparing time of day at this point gives the same result as comparing full date-and-time values.

Preference data requires no pre-processing beyond schema validation at input. The Women+ setting, the Familiar Riders toggle, and the flexibility window are discrete or numeric values stored directly in the user preference and trip tables. The Women+ and familiar-riders rules are applied as a pre-filter before Stage 1, and the flexibility window during Stage 1 and Stage 2.

## 3. Development Phases of the Study {#development-phases-of-the-study .unnumbered}

### **a. Modelling and Experimentation** {#a.-modelling-and-experimentation .unnumbered}

The PSGA runs in production as a Node.js service module with unit tests in Jest. A Python reference implementation of the same formula is kept beside it for experiments: it generates the synthetic dataset and ranks every query with the PSGA and the three baselines without the overhead of running the full application stack. Whenever the algorithm or the dataset changes, the rankings are regenerated; the run is deterministic, and the order in which each query\'s trips were posted is shuffled with a fixed seed, because the generator always created the clearly best trip first, which would otherwise favor the first-posted baseline.

A second Python implementation, written only from the stated specification, re-computes every score; it agreed with the reference on all 500 pairs, which confirms that the formula is implemented as specified. When the reference implementation and the production code are changed together (for example, when the direction check and the Women+ rules were added), the dataset and rankings are regenerated and the tests check that they stay in step.

The default weights w1 = 0.5, w2 = 0.3, w3 = 0.2 are used in production. Once the human ground truth is available, the same scripts can rank the queries with other weight combinations and report precision at rank 1 for each, so the defaults can be compared with alternatives.

## 4. Testing Procedure {#testing-procedure .unnumbered}

### **a. Training and Validation of the Algorithm** {#a.-training-and-validation-of-the-algorithm .unnumbered}

Algorithm validation uses a synthetic dataset. Synthetic data is chosen because the platform has no pre-existing user base at the time of evaluation. The dataset contains 500 passenger-trip pairs (100 passenger queries, each with five candidate trips) generated with a fixed random seed from residential points around real anchor locations within 15 kilometers of Enverga University (barangays such as Ibabang Dupay and Ilayang Dupay, and Sariaya), with the MSEUF campus as the destination. Trip departure times follow a bimodal distribution peaking at 7:00 AM and 4:30 PM to reflect typical class schedules.

For each of the 100 synthetic Passenger queries, the PSGA and the three baselines produce ranked lists. Ground truth labels are assigned by human evaluators as described in Section 5.1.2.5 (Algorithm Validation). Precision at rank 1 measures how often the top result of each method is a ground truth positive. Recall measures the proportion of oracle-valid trips that the PSGA includes in its filtered candidate set. These two metrics assess Stage 1 and Stage 2 quality independently.

## 5. Quality Requirements and Evaluation of Results {#quality-requirements-and-evaluation-of-results .unnumbered}

This evaluation section is divided into two formally separated streams. The first stream covers Algorithm Quality Evaluation, which assesses the PSGA as an independent computational artifact using the synthetic validation dataset and the oracle-based ground truth. The second stream covers System Quality Evaluation, which assesses the full web application against ISO/IEC 25010 quality characteristics. Keeping the two streams separate ensures that the computational contribution and the software product contribution are each evaluated on their own appropriate criteria and reported with distinct metrics.

RideShareEU is evaluated using the ISO/IEC 25010 Software Product Quality standard. The evaluation covers six quality characteristics. Functional suitability is tested through unit tests and integration tests: 73 Jest test files cover the API routes, the PSGA service, the rider rules, the trip day steps, the fuel share, and the other services against a real PostgreSQL database, and further Jest tests cover the frontend helpers. A Postman collection of about 200 requests, run with Newman, walks through the full workflow from sign-in to rating, including authorization failures. GitHub Actions runs the test suites and type checks on every push.

Performance efficiency is measured through a local load test that simulates drivers, riders, and browsing passengers with the app\'s real request timings, stepping from 50 to 1,000 simultaneous users. Response times are benchmarked against the two-second requirement.

Usability is measured through a structured User Acceptance Test of the deployed system with students, faculty, and staff and with evaluators from the ICTD, the Sustainability office, and the Transportation office. Testers follow a public guide, try the passenger and driver tasks, and answer an anonymous evaluation form that maps its items to ISO/IEC 25010 usability sub-characteristics and includes the System Usability Scale. Results are analyzed using descriptive statistics.

Security review covers an OWASP Top 10 code review, a pre-deployment security audit, authentication flow correctness, rate limiting, strict request validation, HTTPS enforcement on all tiers, encryption of personally identifiable fields at rest, and automated tests proving that one user cannot read or change another user\'s data. Compliance with the Data Privacy Act of 2012 is reviewed as part of the ethics documentation.

Algorithm Quality Evaluation (PSGA-specific)

The PSGA is evaluated as a standalone artifact independently of the web application. Metrics are: precision at rank 1, recall, and mean rank of the first acceptable match. These are measured against the synthetic dataset of 100 queries and 500 passenger-trip pairs using the expert oracle defined in Section 5.1.2.5 (Algorithm Validation). Results are compared against the three baselines --- random ranking, route-only matching, and FIFO --- to establish the marginal contribution of the composite scoring and preference components. Algorithm quality results are reported separately from system quality results in the final thesis document.

## 6. Ethics Consideration {#ethics-consideration .unnumbered}

RideShareEU processes personally identifiable information of university members. Full names, institutional email addresses, route data, and schedule patterns are stored in the system. All data handling follows Republic Act 10173. Personal data is encrypted at rest using AES-256 and in transit over HTTPS using TLS 1.2 or higher. A trip\'s route, time, seats, and car model are visible to signed-in members who may join it; the plate number, the trip chat, and live locations are shown only to the host and the approved riders. A Women+ trip is hidden entirely from members who may not join it.

User registration requires acceptance of a terms-of-use agreement stating what data is collected, how it is used, and who can see it. Participation is voluntary. Users can delete their accounts from the profile settings after re-entering their password. Deletion erases the user's name, email, university ID, photo, saved vehicles, preferences, notifications, chat messages, driver's licenses and their photos, push subscriptions, support requests, and home and meeting-point locations; cancels the trips they host and releases seats they hold, notifying everyone affected; and keeps only an anonymized "Deleted user" record so that other users' trip history, the ratings that shaped their trust scores, and safety reports remain intact. No third party receives user data. Accounts are verified through an emailed one-time code sent to the user's institutional address, and passwords are stored only as bcrypt hashes.

User Acceptance Testing participants are voluntary and give consent at the start of the evaluation form; a participant who does not agree is taken to the end of the form. No participant is required to conduct real trips during evaluation: trips posted during the test are test trips, and no money changes hands. The form does not record names or email addresses. Test results are reported in aggregate. Individual responses are not attributed to named participants in the thesis document. Test accounts and trips are deleted after the evaluation period.

### 5.1.3 Description of prototype, where applicable {#description-of-prototype-where-applicable .unnumbered}

The high-fidelity prototype was designed in Figma and then built as the deployed web application at https://rideshare-eu.vercel.app. A bottom navigation bar on phones (a header on wider screens) shows five tabs for the current mode: in Passenger mode Home, My Rides, Find a Ride, Alerts, and Profile; in Driver mode Home, My Trips, Post a Trip, Alerts, and Profile. The main action (Find a Ride or Post a Trip) sits in the middle. A five-step tour introduces the tabs on the first visit. The screens are designed to be calm and short: each leads with the one thing it is for, lists are single bordered lists rather than stacks of cards, and the meaning of icons is given in tooltips.

![](figures/fig09-dashboard.png){width="2.6in"}**Fig. 9 Dashboard Screen**

The Dashboard (Home) is the landing page after login. It greets the user by first name and holds the Passenger | Driver mode switch. In Passenger mode it shows the next ride as a timetable entry, time first, followed by the other upcoming rides. In Driver mode it shows riders waiting for approval, the next trip day with a Confirm button when riders are waiting, and a "This month" summary of the fuel share shown to riders. Announcements from administrators, official warnings, and a prompt to turn on phone notifications appear here when they apply.

![](figures/fig10-mytrips.png){width="2.6in"}**Fig. 10 My Trips Screen**

My Trips (Driver mode) and My Rides (Passenger mode) organize the user\'s trips into three tabs: Upcoming, Past, and Cancelled. Upcoming trips are listed soonest first; past and cancelled trips newest first, filtered to the last 7 days, the last 30 days, or all time. Each row shows the time, the route, how the trip repeats, and seats left, with a badge only when it matters (In progress, Full, Waiting, Declined), and rating prompts appear under finished rides. Opening a row shows the trip page: the trip summary and fuel share, the trip days, the riders (with Approve and Decline for the host), the map, and the chat. While a trip runs, the trip page shows Start Trip, Picked up, and End Trip for the driver and the live map with the car\'s position and estimated arrival for the riders.

![](figures/fig11-findaride.png){width="2.6in"}**Fig. 11** Find a Ride Screen

The Find a Ride screen displays a ranked list of compatible carpools for passengers. The search form takes the pickup and drop-off (with address suggestions and a map pin), the date, the preferred departure time, and the flexibility window, and women and non-binary users can choose to see Women+ trips only. The system presents results sorted by the priority-scored greedy algorithm score. Each result shows the departure time first, how far it is from the preferred time, the route, seats left, the fuel share per seat, the match percentage with a "How is this worked out?" explanation, and the trip\'s rule badges ("Women+ trip", "Familiar riders only"); trips the passenger already joined or requested are marked. Passengers open a result to request to join. When nothing matches, "Show all trips" lists every trip going the passenger\'s way. The search is kept in the address bar, so going back from a trip returns to the same results.

![](figures/fig12-postatrip.png){width="2.6in"}**Fig. 12 Post a Trip Screen**

The Post a Trip screen provides Ride Hosts with the interface to submit commute parameters to the matching engine. Until the host\'s driver\'s license is approved, the screen shows the license status instead of the form. The form has four sections in one column. Route: origin and destination with address suggestions, a map preview of the Mapbox Directions route, and the meeting point; the host can drag the origin and meeting-point pins to exact locations and open the map full screen. When: the departure date and time and how the trip repeats (one-time, daily, weekdays, or selected days of the week). Car and seats: a saved car (the default car is pre-selected), the number of seats, and the fuel price, pre-filled with the official price, from which the fuel share per seat is shown. Who can join: Anyone, or Women+ only for women and non-binary hosts, and the familiar-riders rule, both enforced as hard constraints during matching; who can join cannot change once a rider is approved. A host who is driving a trip at that moment, or whose new trip would overlap another of their trips, cannot post.

Other screens complete the system. Alerts lists the notifications for the current mode. Profile shows the user\'s photo and trust score and groups the settings: ride preferences, driving (driver\'s license, saved cars, and the My driving summary), phone notifications, account, and help and safety. The Driver\'s license page takes the license photo with the in-app camera and shows its status. Help gives emergency guidance and lets users contact the administrators. Administrators have their own console for reports, driver\'s licenses, users, support requests, fuel prices, announcements, monitoring, and the audit log.

**Figma prototype link:** <https://www.figma.com/make/Gd7t6hxETFjBW0TsgpfSE3/RideShareEU-Web-App-Prototype?t=SMWInsnKtPvpxCGW-1&preview-route=%2Ftrip%2Ft3>

### Development Phases of the System

Development runs in five phases aligned with the continuous Kanban backlog.

**Phase 1: Environment and Authentication.** The team sets up the development environment, designs the database schema, and builds school email registration with one-time codes, session tokens, and password reset. This establishes the identity trust foundation that all other features depend on.

**Phase 2: Core Trip and Matching Modules.** The team builds the trip posting interface for hosts, the search and join interface for passengers, and the PSGA matching engine. Route overlap computation, time window filtering, and preference scoring are tested against sample trip data before integration.

**Phase 3: Notifications, Trust, and Fuel Share.** The notification service handles alerts for requests, approvals, reminders, and rating prompts. The rating module collects post-trip scores and updates user trust profiles. The fuel share calculator computes and displays the per-seat contribution when the trip is posted. Safety features follow: reports and the suspension ladder, the administrator role and audit log, Women+ trips, the Help page and support requests, account deletion, and the superadmin's data request process.

**Phase 4: Integration, Security, and Deployment.** All modules integrate into the full application. End-to-end testing covers the complete workflow from registration through trip completion and rating. A pre-deployment security pass adds strict request validation, per-account rate limits, and environment checks. The system deploys to Vercel and Railway, with continuous integration, an uptime check, and daily database backups.

**Phase 5: Panel Revisions and Load Testing.** Following the panel\'s and the adviser\'s comments, the team adds the trip day lifecycle (Start Trip, End Trip, confirmations, skips, and no-shows), Driver and Passenger modes, driver\'s license verification with the automatic check, phone push notifications, passenger location sharing and the live trip map, the driver summary, icons and tooltips, automatic DOE fuel prices, the direction check in the PSGA, and a simpler interface, then runs the load test and adds overload protection. A user acceptance test with verified university community members validates the complete experience.

### Testing Procedure and Evaluation Procedure

RideShareEU is evaluated against ISO/IEC 25010, which defines software quality across functional suitability, performance efficiency, usability, reliability, security, and maintainability.

**Functional suitability** is tested through unit tests on individual API endpoints and integration tests on end-to-end workflows. Jest tests the PSGA service module and all API routes, and a test fails if any write route lacks a request schema. Postman validates the full REST API including matching, authentication, trip days, notifications, licenses, and fuel share endpoints. Both suites run in continuous integration on every push.

**Performance efficiency** is measured through a load test that simulates drivers on running trips (sending their position every 10 seconds), their riders (following the car and chatting), drivers between trips, and passengers browsing and searching, with the app\'s real timings. The number of simultaneous users is stepped from 50 to 1,000, each step lasting 60 seconds, and a request taking longer than 10 seconds counts as an error. Response time is benchmarked against the two-second requirement. With 200 simultaneous users, 95% of requests finished within 73 milliseconds with no errors. In the first run the API collapsed at 600 users; after the alerts check was slowed from every 5 to every 10 seconds and load shedding was added (more than 80 requests in progress are answered "busy, try again in 5 seconds"), 600 users were served with 95% of requests within 0.7 seconds and 2.8% asked to retry, and at 1,000 users nothing timed out and memory stayed at about 440 MB.

**Usability** is measured through a structured User Acceptance Test of the deployed system. Testers reach it through a public guide at /test (also printed as a QR code), which explains how to add the app to the home screen, create an account, turn on notifications, and try it as a passenger and as a driver, ideally in pairs. They then answer an anonymous Google Form. After consent and a short profile, ICTD evaluators rate 20 ISO/IEC 25010 product quality items (functional suitability, performance efficiency, compatibility, reliability, security, maintainability, and portability), and Sustainability and Transportation office evaluators rate 10 campus mobility and sustainability items. Everyone then marks the tasks they completed (create an account, find and request a ride, post a trip, approve a rider, chat, start and follow a trip on the live map, rate, and use Help or report a problem), rates 10 usability items mapped to ISO/IEC 25010 usability sub-characteristics (appropriateness recognizability, learnability, operability, user error protection, user interface aesthetics, and accessibility), answers the ten System Usability Scale items, and leaves comments. All rated items use a five-point Likert scale. Weighted means are interpreted as Strongly agree (4.21 to 5.00), Agree (3.41 to 4.20), Neutral (2.61 to 3.40), Disagree (1.81 to 2.60), and Strongly disagree (1.00 to 1.80). Results are analyzed using descriptive statistics per item, per characteristic, and per group.

**Security** is verified through review of authentication flows, data encryption in transit and at rest, and access control enforcement, including automated tests in which a second user tries every route against the first user\'s data and must receive a refusal. Compliance with Republic Act 10173 is part of the ethics review process documented in Section 6. Acceptance Thresholds and Statistical Interpretation: Functional correctness requires a minimum pass rate of 95% across all defined test cases. Usability is measured using the System Usability Scale (SUS) a mean score of 68 or above is the acceptance threshold consistent with industry standard SUS interpretation. Security testing follows an OWASP Top 10 structured checklist applied as a code-based review; all items rated Critical or High must be resolved before evaluation proceeds. Performance testing measures response time at the 95th percentile under a simulated load of at least 50 concurrent users, with a target of under 2 seconds; the load test above meets it up to 600 simultaneous users. Each SUS response is scored by taking the answer minus 1 for odd items and 5 minus the answer for even items, adding them, and multiplying by 2.5. Usability survey results are reported as mean SUS score with standard deviation and classified using the standard SUS adjective rating scale. Statistical significance is not claimed for the initial UAT given the bounded pilot sample size; results are treated as indicative and framed accordingly in the evaluation discussion.

### Implementation Plan of the System

RideShareEU deploys on a three-tier cloud architecture. The Next.js frontend deploys on Vercel (Singapore region) with automatic HTTPS, continuous deployment from Git, and global CDN. The Express API runs on Railway as a single process, which also runs the scheduled jobs, with a storage volume for profile and license photos. The PostgreSQL database runs on Railway with no public address. The browser talks only to Vercel: Vercel forwards API calls to Railway with a shared secret, and the API refuses requests without it, except its health check.

![](figures/fig13-deployment.png){width="6.3in"}

*Fig. 13 Deployment Architecture*

All tiers communicate over HTTPS using RESTful conventions. Users access the system through any modern browser on desktop or mobile without installation, and can add it to the home screen. School email verification happens at registration through an email service (Brevo or Resend). No personally identifiable information is stored beyond what is required for trip matching, trust management, and safety. Sensitive fields are encrypted at rest.

Practical deployment considerations for the university environment include the following. Database indexes on trip status, host, and match fields keep the candidate query fast as the trip pool grows. The system is designed for a bounded university population estimated at under 10,000 registered users; the load test showed that one API process serves about 600 simultaneous users, and past that the overload protection answers "busy, try again" instead of failing. Scaling further would require one API process per processor core, with the scheduled jobs in only one of them, which is outside the current scope. Operations are monitored by a health check every 15 minutes that emails the team on failure, an error reporting service, and the administrators\' monitoring page. During the user acceptance test the production database is backed up daily (weekly afterwards) through an encrypted tunnel to two physical disks; profile photos are not backed up, which is an accepted limitation. The database schema is frozen during the user acceptance test; afterwards, schema changes move to versioned migrations.

## CS Thesis Workplan

The workplan below is organized by artifact milestone rather than by calendar phase alone. Each row represents a concrete deliverable that marks the completion of a development stage.

**TABLE V**

| **Project Activity / Milestone** | **Deliverable / Output** | **Target Date** |
|----------------|------------------------------|-----------|
| **Project Setup and Environment Configuration** | Next.js frontend and Node.js backend environments ready; project repository and structure created | July 15, 2026 -- July 24, 2026 |
| **Frontend Development -- Login & Verification Screen** | Institutional identity verification UI (University Email/SIS Login) complete | July 25, 2026 -- August 7, 2026 |
| **Frontend Development -- Campus Dashboard** | Main dashboard with active rides, quick search modal, and upcoming trip summary complete | July 25, 2026 -- August 7, 2026 |
| **Frontend Development -- Ride Posting & Route Screen** | Ride host form for recurring campus trips, departure time windows, and route stops complete | August 8, 2026 -- August 21, 2026 |
| **Frontend Development -- Ride Matching & Search Screen** | Semicentralized ride search interface with compatibility filters and match score badges complete | August 8, 2026 -- August 21, 2026 |
| **Frontend Development -- Interactive Campus Route Map** | Interactive map integration showing campus meeting points, route overlap, and driver detour paths | August 22, 2026 -- September 4, 2026 |
| **Frontend Development -- Trip Details & Fuel-Share Panel** | Trip view modal with suggested fuel-share cost split breakdown and co-rider roster complete | August 22, 2026 -- September 4, 2026 |
| **Frontend Development -- Notifications & User Profile** | User profile page with stated carpooling preferences and real-time trip notification center complete | August 22, 2026 -- September 4, 2026 |
| **Database Schema Design and Setup** | Relational database schema (Users, Vehicles, Trips, Matches, Ratings, Notifications) and schema setup ready | September 5, 2026 -- September 11, 2026 |
| **Algorithm Setup -- Date Eligibility and Rider Rules Pre-filter** | Logic implemented to keep only trips that run on the passenger's date and that the passenger may join (Women+ and familiar-riders rules) | September 5, 2026 -- September 11, 2026 |
| **Backend Development -- Institutional Authentication** | Authentication flow and university email verification middleware working | September 12, 2026 -- September 18, 2026 |
| **Backend Development -- Trip & Ride Management APIs** | RESTful API endpoints for posting, updating, and querying campus rides complete | September 12, 2026 -- September 18, 2026 |
| **Algorithm Development -- PSGA Stage 1 (Route Filter)** | Priority-Scored Greedy Algorithm Stage 1 filtering by route overlap percentage and schedule match | September 12, 2026 -- September 18, 2026 |
| **Backend Development -- Geocoding & Mapping APIs** | Route geocoding, distance matrix, and detour distance calculation APIs integrated | September 19, 2026 -- September 25, 2026 |
| **Backend Development -- Fuel-Share Calculation Engine** | Fuel share per seat computed from route distance, fuel efficiency, fuel price, and seats offered | September 19, 2026 -- September 25, 2026 |
| **Backend Development -- Notification & Booking APIs** | Semicentralized ride request, confirmation, and status notification endpoints working | September 19, 2026 -- September 25, 2026 |
| **Algorithm Development -- PSGA Stage 2 (Preference Score)** | Priority-Scored Greedy Algorithm Stage 2 ranking candidate matches by user preference scores | September 19, 2026 -- September 25, 2026 |
| **Algorithm Evaluation & Detour Cost Benchmarking** | Performance report evaluating route overlap accuracy, matching speed, and detour minimization | September 26, 2026 -- October 2, 2026 |
| **Algorithm Integration with Matching API** | Completed PSGA engine integrated into the live backend matching recommendation endpoint | September 26, 2026 -- October 2, 2026 |
| **System Testing (User Story, Black Box, White Box)** | Comprehensive functional, UI, and API test cases completed and documented | September 26, 2026 -- October 2, 2026 |
| **Safety, Administration, and Privacy Features** | Reports and suspension ladder, administrator and superadmin roles, audit log, Women+ trips, Help and support, account deletion, data request process | September 30, 2026 -- October 6, 2026 |
| **Pre-deployment Security Pass and Deployment** | Strict request validation, rate limits, OWASP review; frontend on Vercel and API and database on Railway; CI, uptime check, and backups | October 6, 2026 -- October 8, 2026 |
| **Panel Revisions (Sub-projects A to I)** | Trip day lifecycle, Driver and Passenger modes, driver's license verification, push notifications, passenger location and live trip map, driver summary, icons and tooltips | October 8, 2026 -- October 12, 2026 |
| **Adviser Demo Fixes and Interface Simplification** | PSGA direction check, Show all trips, match explanations, automatic DOE fuel prices, calmer interface, new onboarding tour | October 13, 2026 -- October 18, 2026 |
| **Load Test and Overload Protection** | Load test from 50 to 1,000 simultaneous users; alerts every 10 seconds and load shedding; rerun results documented | October 19, 2026 |
| **User Acceptance Testing (ISO/IEC 25010 and SUS)** | Tester guide and QR code, evaluation form for students, faculty, staff, ICTD, Sustainability and Transportation offices; responses analyzed | October 20, 2026 onward |
| **Align All Manuscript Sections with Completed Application** | Full thesis manuscript (Chapters 1--4) aligned with actual system screenshots, charts, and metrics | October 20, 2026 |
| **Final Defense Preparation and Presentation** | Defense slide deck and live system demo complete; final defense presentation conducted | October 10, 2026 -- October 30, 2026 |
| **Revise Manuscript Based on Panel Feedback** | Revised manuscript incorporating all panel comments and technical recommendations | October 31, 2026 -- November 6, 2026 |
| **Create Revision Matrix and Final Submission** | Revision matrix table completed; final hardbound/electronic manuscript submitted | November 7, 2026 -- November 13, 2026 |

# Ethics Consideration

RideShareEU collects and processes personally identifiable information. This includes full names, institutional email addresses, self-declared gender, route data, schedule patterns, trip-time locations, and, for drivers, driver\'s license details. All users are verified members of Manuel S. Enverga University Foundation. Access requires a school email address that the user proves they control, which limits the user base to known, traceable individuals.

The following ethical concerns apply to this study.

Data privacy. The system stores location-related data in the form of origin, destination, and meeting points, and, during a trip, the driver\'s latest position and the latest position of riders who choose to share it. This data is tied to named user accounts. The study follows the Data Privacy Act of 2012 (Republic Act 10173). Personal data is stored using encrypted database fields. A trip\'s route and time are visible to members who may join it; the plate number, the chat, and live locations only to the host and approved riders. Live locations are erased at pickup, at the end of the trip, or after 30 minutes, and are never shown to administrators or included in a data release.

Informed consent. All users must complete registration and agree to the platform\'s terms and privacy notice before accessing any feature. The registration flow states clearly what data is collected, how it is used, and who sees it. Participation is voluntary. Users withdraw consent by deleting their account, which erases or anonymizes their personal data.

Safety and gender sensitivity. The platform offers Women+ trips, open only to women and non-binary riders and drivers, so that no one is left out by a binary same-gender rule. Gender is self-declared, optional, changeable in the profile, encrypted at rest, and never shown to other users; only administrators reviewing a report can see it. This addresses the documented safety concern specific to female commuters in Philippine university settings. Self-declared gender is not verified; misuse is addressed through host approval, ratings, reports (harassment, including about gender or identity, is a high-alert category), and administrator review, and this is stated as a limitation of the study.

Data access and disclosure. Administrators moderate the platform (reports, bans, the official fuel price) but cannot read trip chats or a user's trip history. A single superadmin account, held by the university's Data Protection Officer, is the only one that can appoint administrators and release a person's trip records to the police or another authority. Each release requires a written legal basis (a Warrant to Disclose Computer Data under A.M. No. 17-11-03-SC, a court order or a subpoena), or an emergency involving a risk to life, in which case only the minimum is released and the paperwork must follow within 72 hours. Every release is recorded permanently in the audit log, consistent with the proportionality and accountability principles of RA 10173.

Institutional data access. The system does not connect to university systems and never asks for institutional passwords. It confirms that a user controls a school email address by sending a one-time code to it, and keeps its own password for the account, stored only as a bcrypt hash. No student or faculty record from the university registry is copied into the RideShareEU database.

Data minimization. The system collects only the data required for matching, fuel share calculation, and safety. No health information or financial account details are collected. A driver\'s license is a government-issued identifier and therefore sensitive personal information under RA 10173; it is collected only from users who want to drive, the photo is taken with the in-app camera, the photo and full number are encrypted and erased once the license is decided (or seven days after an automatic approval), and only the license type, expiry date, last four digits, and decision are kept. The photo is never stored in the public uploads folder and is shown only to administrators reviewing it.

Testing and UAT ethics. User acceptance testing involves students, faculty, staff, and staff of the ICTD, the Sustainability office, and the Transportation office as voluntary participants who give consent in the evaluation form. No participant is required to complete real trips during evaluation, and no money changes hands. The form collects no names or email addresses. Results are reported in aggregate, and test accounts and trips are deleted after the evaluation period.

Prototype scope and deployment boundaries. The current implementation is deployed for academic evaluation within this thesis cycle and is open to MSEUF email addresses during the user acceptance test. It verifies users by school email and does not connect to live university identity records. Integration with university records, or an official campus-wide rollout, would require formal review and approval by the Information and Communications Technology Department (ICTD) and is outside the scope of this thesis; it would also require a separate data privacy impact assessment under Republic Act 10173, a formal security review, and written endorsement from the MSEUF administration.

Objectivity and conflict of interest. The researchers built the system they evaluate, so the study uses the following measures to limit their influence on the results. The ground truth for the algorithm is labeled by evaluators who did not build the application, in workbooks that hide the algorithm\'s scores and list the pairs in different orders, using a rubric fixed before labeling begins. The algorithm, the baselines, and the comparison scripts are deterministic and kept with the dataset, so anyone can rerun them and obtain the same figures. The evaluation form is anonymous, the researchers do not watch participants answer it, and all responses are reported, including unfavorable ratings and comments. Results that do not support the study\'s expectations will be reported and discussed as they are. The researchers declare no financial interest in the study: it receives no funding, the system is free to use and charges no fees, the researchers are not affiliated with any ride-hailing or transport company, and the hosting services are used on their free or hobby plans. The researchers are members of the MSEUF community and could themselves use the platform; this is disclosed as a personal, non-financial interest.

Use of artificial intelligence. The study follows the MSEUF policies and guidelines on the use of AI in research. AI tools were used to assist with parts of the software development and the writing and editing of this manuscript, as listed in the Statement of AI Declaration. All AI-assisted output was reviewed, tested, and revised by the researchers, who take full responsibility for the system, the analysis, and the text. No AI tool generates or alters research data: the evaluation responses come from participants, and the ground truth labels come from human evaluators. Within the system itself, the matching algorithm is a transparent, rule-based method rather than a learned model: every result shows its match percentage and a "How is this worked out?" explanation of the score. The automatic license check only approves licenses whose photo is consistent with the typed details; it never rejects anyone, and every other case is decided by an administrator.

Data security, storage, and compliance. Personal data is protected by HTTPS on every connection, AES-256-GCM encryption of names, gender, trip addresses, and license numbers and photos, bcrypt hashing of passwords, role-based access, rate limits, and an audit log of administrative actions. Driver\'s license photos, the most sensitive data collected, are stored apart from public files, shown only to the administrator reviewing them, and erased once the license is decided. Live locations are kept only while needed and never shown to administrators. Backups are encrypted in transit and stored on disks controlled by the research team. The study follows the MSEUF institutional policy on research data management, and no proprietary or government data is used apart from the publicly published DOE fuel prices.

Societal and environmental impact. RideShareEU is meant to lower commuting costs for students, faculty, and staff, give members without a car a safer way to reach campus, and reduce the number of single-occupancy vehicles on the roads into Lucena City. The study takes care that no vulnerable group is adversely affected. Women and non-binary members can choose Women+ trips without their gender ever being shown to others. Participation is limited to members aged 18 and over. Riders cannot be charged more than a fuel share capped by the official DOE price, so drivers cannot profit from them, and seats are limited to four so that cars are not overloaded and the service is not mistaken for a for-hire (colorum) operation. The interface supports large text and screen readers. Environmentally, the system needs no new hardware or vehicles: it fills seats in cars that are already making the trip, so each shared ride saves fuel and emissions compared with separate trips. Its own footprint is small, since it runs on shared cloud servers and the users\' existing phones.

Benefits and non-maleficence. The study offers practical benefits (lower fuel costs and less coordination effort for commuters, and a ready tool the university could adopt), academic benefits (a documented and validated matching algorithm and evaluation procedure that later researchers can reuse), societal benefits (safer, verified ride sharing within a campus community and fewer vehicles on the road), and policy benefits (evidence the university and local offices can use when considering carpooling programs and parking or transport policies). The researchers also considered how the system could be misused and built safeguards against it. Location sharing could be used to track someone, so the driver\'s position is shared only with approved riders while a trip is running, a rider\'s position is shared only if they turn it on and only until pickup, and positions are erased afterwards. Harassment is handled through reports, an automatic suspension ladder, warnings, and administrator review. Fake accounts are limited by school email verification and false driver identities by the license check. The fuel share cap and the four-seat limit prevent the platform from becoming an unregistered transport business. Lawful requests for data are released only by a single designated data officer, with a recorded legal basis.

# References

\[1\] J. Ranjani, V. K. G. Kalaiselvi, R. P. Dharshini, S. J. S. Samyuktha, and J. D. Priya, \"Transportation management system,\" in *Proc. 1st Int. Conf. Comput. Sci. Technol. (ICCST)*, 2022, pp. 1–6, doi: 10.1109/ICCST55948.2022.10040309.

\[2\] N. S. Mansor, H. Awang, N. F. J. Radzali, A. Bluszcz, A. Zolkipli, and P. F. Yee, \"Optimized campus navigation using mobile app: Network analysis for effective route planning,\" in *Proc. 7th Int. Conf. Internet Appl., Protocols, Services (NETAPPS)*, 2024, pp. 1–7, doi: 10.1109/NETAPPS63333.2024.10823503.

\[3\] C. Bassem, S. Honcharuk, and M. Mokbel, \"Route recommendation to facilitate carpooling,\" in *Proc. 23rd IEEE Int. Conf. Mobile Data Manage. (MDM)*, 2022, pp. 29–34, doi: 10.1109/MDM55031.2022.00025.

\[4\] M.-K. Jiau and S.-C. Huang, \"Services-oriented computing using the compact genetic algorithm for solving the carpool services problem,\" *IEEE Trans. Intell. Transp. Syst.*, vol. 16, no. 5, pp. 2711–2722, Oct. 2015, doi: 10.1109/TITS.2015.2421557.

\[5\] Y. Sun, C. Mu, J. Sun, and Y. He, \"A greedy algorithm-based approach for dynamic carpooling matching and route selection in ride-hailing,\" in *Proc. 19th Int. Conf. Mobility, Sens. Netw. (MSN)*, 2023, pp. 800–805, doi: 10.1109/MSN60784.2023.00117.

\[6\] R. B. Jadhao and J. M. Patil, \"Recommendation system for carpooling and regular taxicab services,\" in *Proc. Int. Conf. Inventive Syst. Control (ICISC)*, 2017, pp. 1–8, doi: 10.1109/ICISC.2017.8068628.

\[7\] B. S. Dharshini, L. Elumalai, and A. Mohamed Aadhil, \"Campus carpooling: Optimized ridesharing for students using hybrid ridesharing algorithm HRA,\" in *Proc. Int. Conf. Emerg. Syst. Intell. Comput. (ESIC)*, 2025, pp. 449–454, doi: 10.1109/ESIC64052.2025.10962610.

\[8\] A. Lugo, N. Aquino, M. González, L. Cernuzzi, and R. Chenú, \"UCarpooling: Decongesting traffic through carpooling using automatic pairings,\" *CLEI Electron. J.*, vol. 24, no. 2, Aug. 2021, doi: 10.19153/cleiej.24.2.10.

\[9\] K. N. Genikomsakis, C. S. Ioakimidis, B. Bocquier, D. Savvidis, and D. Simic, \"Electromobility and carsharing/carpooling services at the University of Deusto: A preliminary exploratory survey,\" in *Proc. 16th Int. IEEE Conf. Intell. Transp. Syst. (ITSC)*, 2013, pp. 1935–1940, doi: 10.1109/ITSC.2013.6728512.

\[10\] O. S. Aba Hussen, S. J. Hashim, N. Sulaiman, S. A. R. Alhaddad, B. Y. Ribbfors, M. Umeda, and K. Katamine, \"Enhancing campus mobility: Simulated multi-objective optimization of electric vehicle sharing systems within an intelligent transportation system frameworks,\" *IEEE Open J. Veh. Technol.*, vol. 6, pp. 315–331, 2025, doi: 10.1109/OJVT.2024.3521091.

\[11\] M. M. Dessouky and S. Hu, \"Dynamic routing for ride-sharing,\" Nat. Center Sustain. Transp., Univ. Southern California, Los Angeles, CA, USA, Rep. NCST-USC-RR-21-22, Nov. 2021, doi: 10.7922/G2D798QK.

\[12\] H. Fehler, M. Pruckner, and M. Schmidt, \"Mobility to campus—A framework to evaluate and compare different mobility modes,\" 2025, *arXiv:2506.13574*.

\[13\] M. Gieza, T. Schuster, L. Waidelich, and B. Kölmel, \"Digital mobility services for communities: Flexible boarding points for campus ridesharing,\" in *Proc. EnviroInfo 2022*, Bonn, Germany: Gesellschaft für Informatik, 2022. \[Online\]. Available: https://dl.gi.de/items/96e91ddf-de40-4ae6-b4c2-d5a5d30ce4e2

\[14\] The SMARTER Center, \"Smart rideshare matching—Feasibility of utilizing personalized preferences,\" Univ. Virginia, Charlottesville, VA, USA. \[Online\]. Available: https://smartercenter.org/projects/smart-rideshare-matching-feasibility-of-utilizing-personalized-preferences/ (accessed Oct. 20, 2026).

\[15\] L. Mitropoulos, A. Kortsari, and G. Ayfantopoulou, \"A systematic literature review of ride-sharing platforms, user factors and barriers,\" *Eur. Transp. Res. Rev.*, vol. 13, Art. no. 61, Dec. 2021, doi: 10.1186/s12544-021-00522-1.

\[16\] I. Malode, T. Nagarale, S. Pawar, M. Bagade, and R. Dahake, \"Ridesharing: Web application for college students,\" *Int. J. Innov. Res. Eng. Multidiscip. Phys. Sci.*, vol. 11, no. 3, May–Jun. 2023. \[Online\]. Available: https://www.ijirmps.org/papers/2023/3/230182.pdf

\[17\] M. Pirra, \"Stated interest, actual use or indifference towards car sharing: Profiling students and staff of a university campus in Turin (Italy),\" *Eur. Transp./Trasporti Europei*, no. 79, pp. 1–25, Sep. 2020, doi: 10.48295/ET.2020.79.1.

\[18\] J. Li, H. Zhang, H. Liu, and S. Wang, \"Multi-objective planning of commuter carpooling under time-varying road network,\" *Sustainability*, vol. 16, no. 2, Art. no. 647, Jan. 2024, doi: 10.3390/su16020647.

\[19\] R. Yao and S. Bekhor, \"A dynamic tree algorithm for peer-to-peer ride-sharing matching,\" 2021, *arXiv:2105.13078*.

\[20\] W. Wang, Y. Li, Y. Tan, R. Kobayashi, H. Hashikami, and M. Shigeno, \"Mathematical models for carpooling considering driver absence: Comparative analysis and heuristic strategies,\" *Comput. Ind. Eng.*, vol. 210, Art. no. 111577, Dec. 2025, doi: 10.1016/j.cie.2025.111577.

\[21\] P. Wang and L. Du, \"Investigating optimal carpool scheme by a semi-centralized ride-matching approach,\" *IEEE Trans. Intell. Transp. Syst.*, vol. 23, no. 9, pp. 14990–15004, Sep. 2022, doi: 10.1109/TITS.2021.3135648.

\[22\] S. Gökay, A. Heuvels, and K. Krempels, \"On-demand ride-sharing services with meeting points,\" in *Proc. 5th Int. Conf. Veh. Technol. Intell. Transp. Syst. (VEHITS)*, 2019, pp. 117–125, doi: 10.5220/0007709101170125.

\[23\] Y. Liang, \"Fairness-aware dynamic ride-hailing matching based on reinforcement learning,\" *Electronics*, vol. 13, no. 4, Art. no. 775, Feb. 2024, doi: 10.3390/electronics13040775.

\[24\] M. E. S. Kamel *et al.*, \"Designing a secure and efficient campus carpooling system: A comprehensive software requirement specification,\" *Preprints*, Mar. 2025, doi: 10.20944/preprints202503.0991.v1.

\[25\] M. E. S. Kamel *et al.*, \"Enhancing campus mobility: A requirement engineering approach to a carpool system for university students and staff,\" *Preprints*, Mar. 2025, doi: 10.20944/preprints202503.0977.v1.

\[26\] B. Prathusha, B. Gouthami, M. Rayudu, A. Rani, K. Kavya, and Channabasamma, \"Peer-to-peer carpooling: Forging a path to sustainable transportation,\" *Int. J. Environ. Sci.*, vol. 11, pp. 441–450, Jun. 2025, doi: 10.64252/kyktxh53.

\[27\] L. Li, H. Zhang, and Z. Gan, \"Factors affecting college students' attitudes towards carpooling,\" *Transp. Saf. Environ.*, vol. 6, no. 2, Art. no. tdad025, 2024, doi: 10.1093/tse/tdad025.

\[28\] M. Arif Khan, R. Patel, S. Kermanshachi, J. Rosenberger, G. Hladik, and R. Etminani-Ghasrodashti, \"Understanding students' satisfaction with university transportation,\" in *Proc. Int. Conf. Transp. Develop. 2023*, ASCE, 2023, pp. 522–532, doi: 10.1061/9780784484876.046.

\[29\] J. Xia, K. M. Curtin, J. Huang, D. Wu, W. Xiu, and Z. Huang, \"A carpool matching model with both social and route networks,\" *Comput. Environ. Urban Syst.*, vol. 75, pp. 90–102, May 2019, doi: 10.1016/j.compenvurbsys.2019.01.008.

\[30\] V. Kanagasabai, K. Wei Yi, M. F. Mohd Ezani, and R. Raja Ikram, \"Towards sustainable commuting: Development of a carpool ride-sharing platform with real-time tracking and safety features,\" *Int. J. Res. Innov. Soc. Sci.*, vol. 9, no. 9, pp. 2582–2596, Oct. 2025, doi: 10.47772/IJRISS.2025.909000222.

\[31\] M. Sahebdel, A. Zeynali, N. Bashir, P. Shenoy, and M. Hajiesmaili, \"LEAD: Towards learning-based equity-aware decarbonization in ridesharing platforms,\" in *Proc. ACM Conf. Fairness, Accountability, Transparency (FAccT)*, 2025, pp. 817–827, doi: 10.1145/3715275.3732051.

\[32\] Z. Wang, L. Li, J. Tang, B. Xie, and J. Ge, \"Effect of ride sharing on air quality: Evidence from Shenzhen, China,\" *J. Appl. Econ.*, vol. 25, no. 1, pp. 197–219, 2022, doi: 10.1080/15140326.2021.2023421.

\[33\] K. P. Seng, L.-M. Ang, E. Ngharamike, and E. Peter, \"Ridesharing and crowdsourcing for smart cities: Technologies, paradigms and use cases,\" *IEEE Access*, vol. 11, pp. 18038–18081, 2023, doi: 10.1109/ACCESS.2023.3243264.

\[34\] S. A. Raza, K. A. Khan, and J. Salam, \"Impact of environmental triggers on students' behavior to use ride-sharing services: The moderating role of perceived risk,\" *Curr. Psychol.*, vol. 42, no. 13, pp. 11329–11343, 2023, doi: 10.1007/s12144-021-02405-z.

\[35\] S. AlQuhtani, \"Ridesharing as a potential sustainable transportation alternative in suburban universities: The case of Najran University, Saudi Arabia,\" *Sustainability*, vol. 14, no. 8, Art. no. 4392, Apr. 2022, doi: 10.3390/su14084392.

\[36\] K. Thopate, M. Sathe, S. Gujar, S. Honmute, P. Savji, and V. Sawandkar, \"VISHWA-CONNECT: A ride sharing mobile application for campus students,\" *Int. J. Res. Appl. Sci. Eng. Technol.*, vol. 10, no. 11, pp. 771–774, Nov. 2022, doi: 10.22214/ijraset.2022.47396.

\[37\] A. Ghorpade, A. Joshi, S. Mali, P. Agrawal, and H. Agrawal, \"POOL: A peer-to-peer ride sharing app,\" *Int. J. Eng. Appl. Sci. Technol.*, vol. 5, no. 12, Apr. 2021, doi: 10.33564/IJEAST.2021.v05i12.045.

\[38\] A. Tafreshian and N. Masoud, \"A truthful subsidy scheme for a peer-to-peer ridesharing market with incomplete information,\" *Transp. Res. Part B Methodol.*, vol. 162, pp. 130–161, Aug. 2022, doi: 10.1016/j.trb.2022.05.010.

\[39\] C. Triki, M. Mahdavi Amiri, R. Tavakkoli-Moghaddam, M. Mokhtarzadeh, and V. Ghezavati, \"A combinatorial auction-based approach for ridesharing in a student transportation system,\" *Networks*, vol. 78, no. 3, pp. 229–247, 2021, doi: 10.1002/net.22074.

\[40\] R. Etminani-Ghasrodashti, G. Hladik, S. Kermanshachi, J. Rosenberger, M. Arif Khan, and A. Foss, \"Exploring shared travel behavior of university students,\" *Transp. Plan. Technol.*, vol. 46, no. 1, pp. 22–44, 2023, doi: 10.1080/03081060.2022.2160718.

\[41\] R. Etminani-Ghasrodashti, M. A. Khan, R. Patel, S. Kermanshachi, J. Rosenberger, and A. Pamidimukkala, \"Measuring students' satisfaction levels for transit services: An application of latent class analysis,\" *Int. J. Transp. Sci. Technol.*, vol. 15, pp. 284–297, Sep. 2024, doi: 10.1016/j.ijtst.2023.10.004.

\[42\] J. Wu, Y. Tian, and J. Sun, \"Managing ridesharing with incentives in a bottleneck model,\" *Res. Transp. Econ.*, vol. 101, Art. no. 101349, Nov. 2023, doi: 10.1016/j.retrec.2023.101349.

\[43\] L. do C. Martins, R. de la Torre, C. G. Corlu, A. A. Juan, and M. A. Masmoudi, \"Optimizing ride-sharing operations in smart sustainable cities: Challenges and the need for agile algorithms,\" *Comput. Ind. Eng.*, vol. 153, Art. no. 107080, Mar. 2021, doi: 10.1016/j.cie.2020.107080.

\[44\] L. Zhou, L. Kang, H. Sun, Y. Bao, Q. Lai, and Q. Xu, \"Ride-sharing matching and route planning based on adjustable passenger pick-up and drop-off points,\" *Transp. Res. Part C Emerg. Technol.*, vol. 182, Art. no. 105394, Jan. 2026, doi: 10.1016/j.trc.2025.105394.

\[45\] N. Alisoltani, M. Ameli, M. Zargayouna, and L. Leclercq, \"Space-time clustering-based method to optimize shareability in real-time ride-sharing,\" *PLOS ONE*, vol. 17, no. 1, Art. no. e0262499, Jan. 2022, doi: 10.1371/journal.pone.0262499.

\[46\] B. Cao, C. Hou, L. Zhao, L. Alarabi, J. Fan, M. F. Mokbel, and A. Basalamah, \"SHAREK\*: A scalable matching method for dynamic ride sharing,\" *GeoInformatica*, vol. 24, no. 4, pp. 881–913, 2020, doi: 10.1007/s10707-020-00411-0.

\[47\] O. D. Tawa and Y. Guo, \"Dynamic timeframe and anticipation-based migration: A real-time framework for ride-sharing,\" *Acad. J. Sci. Technol.*, vol. 7, no. 3, pp. 89–96, Oct. 2023, doi: 10.54097/ajst.v7i3.13055.

\[48\] H. Zuo, B. Cao, Y. Zhao, B. Shen, W. Zheng, and Y. Huang, \"High-capacity ride-sharing via shortest path clustering on large road networks,\" *J. Supercomput.*, vol. 77, pp. 4081–4106, 2021, doi: 10.1007/s11227-020-03424-6.

\[49\] J. Lv, J. Hao, S. Yao, and H. Tan, \"A two-sided stable matching method in ridesharing,\" in *Proc. IEEE 8th Int. Conf. Cloud Comput. Intell. Syst. (CCIS)*, 2022, pp. 671–675, doi: 10.1109/CCIS57298.2022.10016360.

\[50\] S. Nabila, T. Hashem, S. Anwar, and A. Islam, \"Efficient algorithms for community aware ridesharing,\" *GeoInformatica*, vol. 28, pp. 403–432, 2024, doi: 10.1007/s10707-023-00509-1.

\[51\] F. D. Davis, \"Perceived usefulness, perceived ease of use, and user acceptance of information technology,\" *MIS Quarterly*, vol. 13, no. 3, pp. 319–340, 1989, doi: 10.2307/249008.

\[52\] I. Ajzen, \"The theory of planned behavior,\" *Organ. Behav. Hum. Decis. Process.*, vol. 50, no. 2, pp. 179–211, 1991, doi: 10.1016/0749-5978(91)90020-T.

\[53\] R. C. Mayer, J. H. Davis, and F. D. Schoorman, \"An integrative model of organizational trust,\" *Acad. Manage. Rev.*, vol. 20, no. 3, pp. 709–734, 1995, doi: 10.5465/amr.1995.9508080335.

# Statement of AI Declaration

We declare that the following AI tools were utilized. All AI-assisted output was reviewed, tested, and revised by the researchers, who take full responsibility for the system, the data, the analysis, and this manuscript. No AI tool was used to generate or alter research data: evaluation responses come from participants and ground truth labels come from human evaluators.

**TABLE VI**

| **AI Tools (1)** | **Descriptions of how the information was generated (2)** | **Prompts Used (3)** | **Descriptions of how the output was used in your work (4)** |
|----------|------------------------|------------------------|------------------------|
| **ChatGPT (GPT, OpenAI)** | To refine the clarity of the introduction and emphasize the rationale of the problem; to suggest clearer wording for selected paragraphs. | "Here is my draft: enhance the clarity of my write-up, emphasizing the context of the problem." / "Make this paragraph clearer without changing its meaning." | The output was reviewed line by line and further modified to ensure that our original ideas and claims were preserved. |
| **Claude (Anthropic)** | To conceptualize the software architecture and define the modular structure of the web application; to discuss design options for the matching algorithm. | "Act as a software architect. Outline a three-tier architecture for a campus carpooling web app using Next.js and Node.js, ensuring the matching algorithm is isolated from the API." | The output served as a structural guide for the system architecture and UML diagrams, which we then modified to fit the Priority-Scored Greedy Algorithm (PSGA) and our requirements. |
| **Claude Code (Anthropic)** | As an AI coding assistant in the development environment: to help write, debug, test, and refactor the application code; to set up deployment, security checks, and automated tests; to build the evaluation form and tester guide; and to help align this manuscript with the finished system, redraw its diagrams, and check its references against publisher records. | "Implement the trip day lifecycle (confirm, start, end, no-show) with tests." / "Find why this test fails and fix the cause." / "Revise the manuscript so it matches how the system actually works." / "Verify each reference against its publisher page and fix the citations." | All code was reviewed, run, and tested by the researchers before it was merged; automated tests and manual checks confirmed its behavior. Manuscript changes were reviewed against the system and the cited sources, and the researchers decided what was kept. |
| **Gemini (Google)** | To audit and correct the manuscript's in-text citations and reference list for IEEE style compliance. | "Double check if I referenced using IEEE properly." / "Can you fix the structural errors in my reference list?" | The output was reviewed to understand IEEE formatting rules. The corrections were applied to fix adjacent in-text brackets, format preprint repositories, and add access dates in the References section. |
