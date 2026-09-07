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

**Engr. Roselyn A. Maaño**

> Adviser

Approved by the committee on Oral Examination with a grade of \_\_\_\_\_\_\_\_\_.

John Rover Sinag

Chairman

Dean Rodrigo C. Belleza Jr. Jericho Gutierrez

Member Member

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

Fig. 12 -- Post a Ride Screen 69

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

This study presents the design, implementation, and validation of a Priority-Scored Greedy Algorithm (PSGA) for schedule-based university carpooling, integrated into a web-based carpool coordination platform restricted to a verified institutional community. The core software engineering contribution is the formulation of a two-stage matching engine that filters candidates by route overlap and schedule compatibility, then ranks them by a weighted composite of user preferences, operating within a closed network authenticated through institutional ICTD credentials. The system applies to a two-stage matching engine---filtering by route overlap and schedule compatibility, then ranking by stated user preferences ---within a closed network authenticated through institutional ICTD credentials. Evaluation follows ISO/IEC 25010 across functionality, usability, and security, with user acceptance testing conducted among students, faculty, and staff of Manuel S. Enverga University Foundation. The PSGA is validated independently from the full web application using synthetic match scenarios with controlled parameters, measuring precision at rank 1 and recall against an expert-defined ground truth prior to system integration. The platform addresses the documented barriers of trust, cost, and coordination overhead by restricting access to verified university members and displaying concrete fuel share calculations at the point of match confirmation.

***Index Terms:** Campus carpooling, Priority-scored greedy algorithm, University ride sharing, Identity verification, Sustainable commuting, Software engineering, ISO 25010, Web application, Fuel cost reduction.*

# Introduction

## Background of the Study

Fuel prices in the Philippines have risen consistently in recent years. For students, faculty, and employees who drive alone to campus every day, this means a growing portion of their income goes directly to fuel with no way to offset it. At the same time, roads near Philippine universities remain congested during peak hours, extending travel time and compounding the cost of solo commuting. Vehicle emissions from low-occupancy private cars contribute to both air quality problems and public health burdens in surrounding communities \[2\]. These three pressures, rising fuel costs, congestion, and emissions, share a common root cause. Most vehicles on the road carry only one person.

Ride sharing addresses this directly. It fills seats that already exist in vehicles already making the trip. A driver who gets even one passenger immediately reduces their personal fuel cost for that trip. No new behavior is required, only coordination.

The impact of organized ride sharing is measurable. A simulation in Lyon, France found that a peer-to-peer carpooling system reduced total travel distance by 8.0% and cut total trips by 17.16% \[1\]. These figures show what becomes possible when commuters with compatible routes and schedules are matched consistently.

University campuses are well suited for this kind of system. Students, faculty, and employees travel between fixed residential areas and a central campus on predictable schedules throughout the academic year. This regularity makes the matching problem tractable. Existing commercial platforms do not serve this context. They are built for single, on-demand trips and cannot handle the recurring, schedule-based commutes that define campus life \[3\]. No dedicated platform exists for most Philippine university communities.

Research on ride sharing adoption identifies three consistent barriers: distrust between users, low perceived convenience, and safety concerns, particularly among female commuters \[2\]. A campus-focused platform can address these directly. Restricting access to verified university members through institutional identity credentials removes the stranger problem entirely. Users share a campus, a code of conduct, and traceable identities. That foundation makes trust achievable without relying on reputation systems built from scratch.

The technical side of the problem is solved. Algorithms for matching riders to drivers based on route overlap and schedule compatibility are well documented. Greedy matching methods process requests efficiently by scoring each candidate ride against a set of rules and selecting the highest-scoring option \[3\]. Campus carpooling systems have been built and tested using these approaches, implementing modules for user registration, ride posting, and preference-based filtering \[4\], \[5\]. The gap is not a missing algorithm. The gap is a system that applies these methods within a trusted, closed network built for a specific university community.

RideShareEU fills that gap. It is a web-based carpool coordination platform restricted to verified members of a university community through institutional identity verification. The core matching engine uses a priority-scored greedy algorithm. It filters available trips in two stages: first by route overlap and schedule compatibility, then by stated user preferences including co-rider gender, departure time flexibility, and familiarity. Drivers post trips as ride hosts. Passengers request to join. Hosts approve manually. Cost sharing is arranged directly between users outside the platform. The suggested contribution is framed as a voluntary fuel share. No fares, no payments, and no earnings are processed by the system.

The goal is a practical, everyday tool that reduces the fuel cost burden on campus commuters. The thesis contribution lies in three areas: the design of the priority-scored matching logic, the architecture of a trusted institutional platform with verified identity as its access foundation, and the efficient software realization of both within a standard web application stack. The contribution of this study is not in transportation planning but in software engineering: the design and validation of a matching algorithm and the trusted institutional platform architecture that makes it deployable within a university community.

## Statement of the Problem 

Students, faculty, and employees at Philippine universities face rising fuel prices, daily congestion, and a lack of safe alternatives to solo vehicle use. Those who drive alone absorb the full cost of fuel every trip with no way to distribute that cost. Commercial ride-hailing platforms are not built for recurring, schedule-based campus commutes and do not provide the identity verification that institutional communities require for trust.

A dedicated campus carpool coordination system is missing. The system needs to verify users through university credentials, match them for scheduled recurring trips based on route and preference compatibility, and operate as a private coordination platform rather than a commercial transport service. The algorithms for this kind of matching exist. The software engineering challenge is building a system that matches correctly and quickly within a bounded two-second response constraint and operates safely within the access-controlled boundaries of a closed institutional network, where identity verification, preference filtering, and algorithmic ranking must work together as an integrated and testable system. Applying them correctly within a verified, closed campus network is the gap this project addresses.

## Main and Specific Objectives

The main objective is to design, develop, and evaluate RideShareEU, a web-based carpool coordination platform for a verified university community. The system will use a priority-scored greedy matching algorithm to facilitate safe, recurring, and route-based ride sharing with the goal of reducing individual fuel costs and the total number of solo vehicle trips among campus commuters.

Specific Objectives

1.  Document the commuting cost burden faced by students, faculty, and employees at MSEUF as contextual evidence for the economic motivation underlying the carpooling platform, treated as background input rather than a primary engineering deliverable.

2.  Design the system architecture and database for a secure, web-based carpool coordination platform with institutional identity verification.

3.  Develop core functionalities, including user authentication via school credentials, trip posting by ride hosts, and a two-stage priority-scored greedy matching algorithm for scheduled commutes.

4.  Validate the Priority-Scored Greedy Algorithm as an independent computational artifact using synthetic match scenarios with controlled inputs, measuring precision at rank 1, recall, and match quality against an expert-defined ground truth, before integration into the full web application.

5.  Implement safety and trust features, including ride history, ratings and reviews, a report and flag system, and optional live location sharing.

6.  Evaluate the system based on functionality, usability, and user satisfaction using standard software evaluation methods.

## Significance of the research

Daily commuting to and from Enverga University places a direct financial burden on students, faculty, and staff who travel by private vehicle. Most of these vehicles carry only the driver. Fuel costs in the Philippines have risen consistently since 2022, and road congestion near campus peaks during morning and afternoon class schedules. RideShareEU targets this directly. It is a web-based carpool coordination platform built for the verified university community using the Priority-Scored Greedy Algorithm (PSGA) to match Ride Hosts with Passengers based on route, schedule, and preferences.

The following groups benefit from this system.

**Students.** Students bear the highest transportation cost relative to income. A single carpool match from a residential area to campus can split fuel cost across two to four people. Over one semester, this reduces out-of-pocket transport spending for both the Ride Host and the Passenger. The identity-verified closed network removes the distrust barrier that prevents students from using general-purpose ride-sharing apps. The PSGA match result shows the computed fuel share contribution at the point of match confirmation, giving students a concrete cost figure before accepting a trip.

**Faculty and Staff.** Faculty and staff members travel from fixed residential areas on predictable daily schedules, which makes them strong candidates for recurring carpool matches. The PSGA recurrence setting lets a Ride Host post a single trip with a daily or weekly repeat pattern. A Passenger who matches that post joins all recurrences without re-submitting a search each day. This reduces coordination overhead for both parties and keeps fuel share benefits consistent throughout the academic term.

**Female Commuters.** Research on ride-sharing adoption in Philippine university settings identifies safety as the primary barrier for female commuters. RideShareEU addresses this through two mechanisms. First, access requires ICTD credential verification, which limits the platform to known, traceable university members. Second, the Matching Preferences screen includes a co-rider gender filter. When a female user enables this setting, the PSGA applies it as a hard constraint during Stage 1 filtering, removing any candidate trip whose Ride Host or existing Passengers do not satisfy the preference. The match result presented to the user reflects this filter before confirmation.

**The University Administration.** Campus-adjacent congestion during arrival and departure peaks creates operational challenges for the university. Each additional carpool match reduces the number of single-occupancy vehicles entering the campus perimeter. The system does not require institutional infrastructure changes. It runs entirely as a web application accessible from any browser. The administration receives a functional tool that addresses a documented campus traffic problem without procurement of hardware or modification of existing systems.

**Future Researchers and Developers.** RideShareEU produces a validated implementation of the Priority-Scored Greedy Algorithm for carpool matching in a bounded, identity-verified community. The PSGA formulation, weight configuration, and evaluation results contribute to the documented body of campus carpooling algorithms. The implementation is the first known application of a priority-scored greedy approach to a Philippine university commute context, where tropical scheduling patterns and single-semester academic cycles differ from the European and North American datasets that dominate existing literature. The practical research contribution is specifically threefold: the PSGA formulation and weight configuration are documented as a reusable algorithmic artifact; the verified identity integration architecture provides a reference pattern for other institutional platforms requiring closed-network access control; and the recurring-trip coordination model is the first documented implementation of standing match agreements in a Philippine university commuting context.

**The Local Community and Environment.** Enverga University is located in Lucena City, where traffic density on approach roads during academic hours affects residents beyond the university boundary. Fewer single-occupancy vehicles reduce fuel consumption, vehicle emissions, and road congestion for the surrounding area. Each matched trip that fills otherwise empty seats decreases the total number of vehicle trips between the residential origin clusters and the campus destination.

## Scope and Limitation

The project covers the development of a functional web application prototype for a defined university community. Access is restricted to verified students through the university student portal and school email verification, minimizing administrative integration risks while maintaining closed-network security. Core features include ride host trip posting, rider join requests, manual host approval, and a two-stage matching algorithm. Safety and trust features include institutional identity verification, a mutual ratings and review system, a report and flag mechanism, and optional live location sharing visible to matched participants. These features are consistently reflected in the system objectives, conceptual framework, and design modules. The first stage filters trips by route overlap and schedule compatibility. The second stage ranks results using stated preferences including co-rider gender, departure time flexibility, and familiarity.

The platform does not process payments. Cost sharing is arranged directly between users. The suggested contribution is framed as a voluntary fuel share, not a fare. The system will not track earnings or charge platform fees. Testing uses simulated user data, not live deployment data. Evaluation focuses on technical functionality and initial user feedback. Advanced optimization techniques such as machine learning-based demand prediction and real-time dynamic dispatch are beyond the current scope. The system focuses on scheduled, recurring trips rather than on-demand ride matching.

# Theoretical Framework

## Concept Map

![](media/image2.png){width="6.3686811023622045in" height="3.4611220472440944in"}Fig. 1 Concept Map

## Review of Related Literature 

**Introduction**

Technology acceptance models provide a framework for predicting and explaining user adoption of information systems. The Technology Acceptance Model posits that perceived usefulness and perceived ease of use are the primary determinants of adoption intention for any new technology. Applied to ride-sharing platforms, perceived usefulness maps to the economic and convenience benefits users expect to receive, while perceived ease of use maps to the learnability and efficiency of the interface. Studies applying TAM to ride-sharing contexts confirm that perceived usefulness has a somewhat stronger effect than ease of use for transportation applications \[27\].

> ***3.2.9.1.2 Theory of Planned Behavior***

The study of factors affecting college students\' attitudes toward carpooling confirmed that subjective norms, meaning the perception that people one respects also use carpooling, significantly predict adoption intention independently of individual attitudes \[27\]. This finding comes from the Theory of Planned Behavior, which extends TAM by adding social influence as a determinant of behavior. For RideShareEU, the design implication is that social visibility features, such as displaying the number of active users in the community and highlighting successful rides, can leverage peer influence to drive adoption.

Research found that environmental motivations interact with risk perceptions in a multiplicative way \[34\]. Students who felt their personal safety was adequately protected showed a strong response to environmental messaging. Students who perceived high personal risk showed almost no response to environmental appeals. Safety features must be implemented and communicated before any sustainability messaging will have effect. For RideShareEU, TAM and TPB serve a narrow and targeted purpose they explain which design features are needed to encourage adoption, not how the system is engineered. The verified identity badge addresses the trust barrier; the fuel cost calculator addresses perceived usefulness from TAM the community activity display addresses subjective norms from TPB. These three connections are the extent to which behavioral theory shapes the platform. The core contribution of this thesis remains in software engineering the PSGA formulation, the verified identity architecture, and their integration into a functioning web application. The theoretical framing is kept to these targeted connections intentionally, so it does not overshadow the engineering work.

### 3.2.1 Trust Theory in Technology-Mediated Interactions {#trust-theory-in-technology-mediated-interactions .unnumbered}

> *3.2.1.1 Dimensions of Trust in Ride Sharing*

Trust in technology-mediated interactions has been studied extensively in the context of online marketplaces, sharing economy platforms, and collaborative consumption services. The key insight is that trust is not a single construct. It involves trust in the platform\'s security, trust in the counterpart\'s identity, trust in the counterpart\'s behavior, and trust in the institutional backing of the system. Each type of trust is addressed by different design and policy mechanisms.

> *3.2.1.2 Institutional Trust as a Foundation*

For a campus ride-sharing platform, institutional trust is the most foundational. When the university formally endorses the platform and takes responsibility for user verification, it lends its own credibility to the system. This institutional trust reduces the cognitive burden on individual users, who no longer need to independently evaluate the trustworthiness of each potential ride partner \[4\], \[5\].

Identity trust, confidence that the matched person is who they claim to be, is addressed by the verification mechanism. Behavioral trust, confidence that the matched person will behave appropriately during the ride, is addressed by the rating and review system. Platform security trust, confidence that personal data is handled safely, is addressed by encryption and data governance practices. A complete trust framework for RideShareEU requires all four elements: institutional endorsement, identity verification, behavioral rating, and data security.

### 3.2.2 Sustainable Transportation Theory {#sustainable-transportation-theory .unnumbered}

> *3.2.2.1 Cultural and Institutional Barriers to Adoption*

Sustainable transportation theory examines how transportation systems can meet current mobility needs without compromising future environmental conditions. Carpooling is one of the most direct interventions available because it reduces vehicle use without requiring changes to vehicle technology or fuel sources. The efficiency gain is immediate and proportional to the increase in average vehicle occupancy.

A peer-to-peer carpooling study framed carpooling within the broader sustainable mobility transition, noting that cultural and institutional barriers, not technology, are now the primary obstacles to large-scale adoption \[40\]. The technology for effective carpooling matching exists and is proven. The challenge is creating the social conditions under which people routinely choose coordinated travel over solo travel. University campuses are social environments with existing community bonds and shared institutional values. They represent favorable conditions for overcoming the cultural barriers to carpooling adoption that resist intervention in more anonymous urban contexts.

## 3.2.3 Synthesis of the Literature and Identified Gaps {#synthesis-of-the-literature-and-identified-gaps .unnumbered}

### 3.2.3.1 What the Literature Confirms {#what-the-literature-confirms .unnumbered}

The literature reviewed in the preceding sections establishes several conclusions that directly inform the design of RideShareEU. Traffic congestion, rising fuel costs, and environmental harm from private vehicle use are well-documented problems that organized ride sharing can address \[2\]\[44\]. Simulation and implementation studies confirm that organized carpooling promotes shared vehicle use within the campus commuter pool, which has the potential to reduce vehicle trips and individual fuel expenses when participation rates are sufficient. The peer-to-peer model is particularly effective in communities with predictable, recurring travel patterns between common origin-destination pairs.

The university setting satisfies the conditions for effective peer-to-peer carpooling in ways that general urban contexts do not \[8\], \[11\]. Origin-destination concentration on the campus, schedule predictability from academic timetables, and existing community bonds among students and staff all reduce the barriers to successful matching. The trust problem, the most significant barrier to general-population ride sharing, is substantially mitigated by institutional verification available to a university platform \[4\] \[5\].

The technical requirements for a campus carpooling platform are well established in the literature \[3\], \[12\], \[14\]. Core functional requirements include verified user authentication, ride posting with recurrence support, priority-scored greedy matching ranked by route and schedule compatibility, and a communication module for match confirmation. These requirements are achievable with standard web development tools and do not require specialized infrastructure.

### 3.2.3.2 Gaps in the Existing Literature {#gaps-in-the-existing-literature .unnumbered}

Despite the volume of research on ride sharing and campus mobility, specific gaps remain that RideShareEU addresses.

**Gap 1: Geographic and Contextual Gap:** The majority of documented campus carpooling systems come from contexts in Europe, North America, East Asia, and the Middle East. Published research on campus ride-sharing systems specifically designed for and evaluated in Southeast Asian contexts, including the Philippines, is sparse. The transportation infrastructure, commuting patterns, cost structures, and social dynamics of Philippine universities differ from these better-studied contexts. A system designed and evaluated for a Philippine university community fills this geographic and contextual gap.

**Gap 2: Full Development Cycle Documentation:** Most published campus carpool implementations focus on either the algorithmic matching component or the application architecture in isolation. Few published studies document the full development cycle from requirement specification through implementation and evaluation for a campus platform. The IJIRMPS paper by Malode et al. \[3\] and the SRS by Kamel et al. \[4\] come closest, but neither documents an evaluated, deployed prototype. RideShareEU aims to produce a documented, evaluated prototype that contributes a complete development case study to the literature.

**Gap 3: User Preference Integration:** The literature on user preference integration in campus carpooling matching is underdeveloped. Studies confirm that preferences matter and that ignoring them reduces adoption, but few studies specify which preference dimensions have the highest impact on match acceptance rates in a campus context \[25\]. RideShareEU\'s evaluation phase will contribute additional data on preference-matching outcomes in the specific context of a Philippine university community.

**Gap 4:** Fuel Cost as an Adoption Driver: The existing campus ride-sharing literature frames adoption drivers primarily in terms of convenience and environmental benefit. Few studies examine rising fuel costs as the primary economic motivator, particularly in a Philippine context where fuel prices have increased substantially and public transit alternatives are limited. RideShareEU positions fuel cost sharing as the central value proposition, which distinguishes its adoption strategy from systems that rely on environmental messaging or convenience alone.

**Gap 5: Recurring Trip Model:** The literature does not adequately address the recurring trip model as distinct from single-trip matching. The majority of ride-sharing research focuses on matching individual trips \[1, \]\[14\]. The university carpooling use case is fundamentally about recurring trips on fixed weekly schedules. RideShareEU addresses this by making recurring trip posting and standing match agreements core features of the system, which distinguishes it from general-purpose ride-hailing applications that dominate the existing literature.

### 3.2.3.3 Position of RideShareEU Within the Literature {#position-of-rideshareeu-within-the-literature .unnumbered}

RideShareEU occupies a specific and defensible position within the existing body of research and development. It applies established technical approaches, including priority-scored greedy matching algorithm \[12\], recurring trip scheduling \[11\], and institutional identity verification \[4\], \[5\], within a context that the literature has identified as favorable but underserved. It extends the documented campus carpooling literature by providing a complete development case in a Philippine university setting with evaluation against both technical and usability standards.

The system does not attempt to push the technical frontier of matching algorithms or real-time optimization. Its contribution is practical: it demonstrates that proven carpooling technology, applied within a verified institutional community, can directly reduce individual fuel costs for campus commuters and address the specific transportation challenges of Philippine university communities in a way that commercial ride-hailing platforms cannot. This practical contribution aligns with the broader literature\'s finding that the key obstacle to campus carpooling adoption is institutional and social, not technical \[40\], \[2\]

3.3 Review of Related Studies

This section presents studies whose research designs, objectives, and findings are directly comparable to RideShareEU. Unlike the thematic literature review in Section 3.2, the studies below are examined as whole research projects, with attention to their scope, methodology, target population, system features, and documented outcomes. Each study is evaluated for the specific lessons it contributes to the design and evaluation of RideShareEU.

## 3.3.1 Campus Carpooling System Studies {#campus-carpooling-system-studies .unnumbered}

### 3.3.1.1 Carpooling: Automatic Pairings for University Carpooling {#carpooling-automatic-pairings-for-university-carpooling .unnumbered}

Ucarpooling was developed to address the absence of an automated matching solution for university commuters \[8\]. The study built and tested a web-based platform that paired students and staff based on residential proximity to campus and schedule overlap. The system used a priority-scored greedy method that assigned weights to route overlap percentage, departure time difference, and prior shared-ride history. The research evaluated the system through user testing and measured match completion rates.

The study found that users who received a ranked list of match suggestions completed ride arrangements at a significantly higher rate than users who browsed unfiltered listings. This directly demonstrates that algorithmic ranking, even without machine learning, produces measurable improvements in user outcomes. RideShareEU adopts the same ranked-suggestion approach and uses a comparable scoring logic. The primary distinction is that RideShareEU adds institutional identity verification as a prerequisite for all users, a requirement that Ucarpooling did not implement.

### 3.3.1.2 Campus Carpooling Using Hybrid Ridesharing Algorithm {#campus-carpooling-using-hybrid-ridesharing-algorithm .unnumbered}

This IEEE study developed and tested a campus-specific matching algorithm called the Hybrid Ridesharing Algorithm \[7\]. The research was conducted in a university setting and targeted students as the primary user population. The HRA combined geographic route clustering with preference-based filtering. In the first stage, the algorithm identified candidate matches whose routes overlapped beyond a minimum threshold. In the second stage, it filtered candidates based on stated preferences including gender, familiarity, and schedule flexibility.

The study reported a 28% reduction in unmatched users compared to a route-only matching baseline. This is the most directly applicable quantitative benchmark available for RideShareEU\'s matching module design. The two-stage approach, geographic pre-filtering followed by preference filtering, is the same structural logic that RideShareEU implements. The study also noted that users in the preference-filtered group reported higher satisfaction with their assigned matches, supporting the investment in preference elicitation at the registration stage.

### 3.3.1.3 Ridesharing Web Application for College Students {#ridesharing-web-application-for-college-students .unnumbered}

Malode et al. designed, developed, and documented a full web application for ride sharing among college students in India \[16\]. The study is one of the few in the literature to cover the complete development cycle, from requirement analysis through implementation and testing. The system was organized into five functional modules: user management, ride posting, ride search and matching, communication, and trip confirmation. The researchers used three-tier architecture separating presentation, business logic, and data access.

The study\'s primary contribution to RideShareEU is its documented module structure and development process. It confirms that a five-module web application is sufficient to cover the core functionality of a campus ride-sharing system, and that the three-tier architecture supports the separation of concerns needed for maintainable development. RideShareEU extends this design by adding a verified identity layer and a recurring trip model, which the Indian system did not implement.

## 3.3.2 Safety and Verification Focused Studies {#safety-and-verification-focused-studies .unnumbered}

### 3.3.2.1 Designing a Secure and Efficient Campus Carpooling System {#designing-a-secure-and-efficient-campus-carpooling-system .unnumbered}

Kamel et al. produced a Software Requirement Specification for a campus carpooling system at Taylor\'s University in Malaysia \[4\]. The research used formal requirement engineering methodology, producing a complete SRS document that specified functional requirements, non-functional requirements, quality attributes, and acceptance conditions. The SRS identified identity verification as the highest-priority security requirement and mandated integration with the university\'s student information system.

This study is the closest methodological parallel to the design phase of RideShareEU. Both projects serve a university community, both treat verified identity as the foundation of the trust model, and both produce formal requirement specifications. The SRS by Kamel et al. serves as a validation reference for RideShareEU\'s own requirement specifications. Where the Malaysian system specified real-time ride updates and an incentive-based reward scheme as key features, RideShareEU focuses on recurring trip scheduling and route-based matching, reflecting the different commuting profiles of the two institutions.

### 3.3.2.2 Towards Sustainable Commuting: Carpool Platform with Real-Time Tracking {#towards-sustainable-commuting-carpool-platform-with-real-time-tracking .unnumbered}

This 2025 study developed a carpool ride-sharing platform and specifically evaluated the impact of safety features on user confidence and adoption \[30\]. The research implemented real-time GPS tracking visible to both the driver and a designated emergency contact, an in-app panic button, and a verified user profile system. The study measured user-reported safety confidence before and after exposure to each feature.

The results showed that real-time GPS tracking produced the largest increase in safety confidence among female users, followed by the visible verified profile badge. The panic button, despite low activation rates, significantly increased perceived safety simply by being available. These findings inform the priority order of safety feature implementation in RideShareEU. The verified identity badge, which is central to RideShareEU\'s design, receives strong empirical support as a trust signal from this study.

## 3.3.3 Requirement Engineering and User-Centered Studies {#requirement-engineering-and-user-centered-studies .unnumbered}

### 3.3.3.1 Enhancing Campus Mobility: Requirement Engineering Approach {#enhancing-campus-mobility-requirement-engineering-approach .unnumbered}

Kamel et al.\'s companion paper detailed the requirement elicitation process behind the SRS described in Section 3.3.2.1 \[5\]. The researchers used structured questionnaires and semi-structured interviews with students and staff at Taylor\'s University. The study systematically analyzed the results to derive functional and non-functional requirements. The key finding from elicitation was that verified institutional identity was the dominant factor driving willingness to use the platform, outweighing cost savings, schedule convenience, and safety features in stated preference rankings.

This study provides direct empirical support for the central design decision of RideShareEU: restricting access to verified university members. The Philippine University context differs in cost structure and transit availability from Malaysia, but the trust dynamics are comparable. Both populations are university communities where institutional membership is a meaningful social credential. The elicitation methodology used by Kamel et al. also serves as a template for the user needs analysis component of RideShareEU\'s development process.

### 3.3.3.2 Factors Affecting College Students\' Attitudes Toward Carpooling {#factors-affecting-college-students-attitudes-toward-carpooling .unnumbered}

Li, Zhang, and Gan surveyed students at a Chinese university and modeled the factors that predict carpooling attitudes and behavioral intentions \[27\]. The study applied structural equation modeling to survey data and tested a model incorporating perceived convenience, cost sensitivity, social norms, and safety perceptions. The model confirmed that cost sensitivity and social norms were the two strongest predictors of positive carpooling attitudes. Safety perceptions moderated the effect of convenience on intention, particularly for female respondents.

This study is relevant to RideShareEU at the design and evaluation levels. At the design level, it confirms that cost display and social proof features are the highest return interface investments for driving adoption. At the evaluation level, it provides a validated instrument for measuring carpooling attitudes that RideShareEU can adapt for its user satisfaction evaluation. The study also identifies gender as a moderating variable, which informs the decision to include gender preference as a matching criterion in RideShareEU.

## 3.3.4 Ridesharing as a Sustainable Transportation Alternative {#ridesharing-as-a-sustainable-transportation-alternative .unnumbered}

### 3.3.4.1 Najran University Case Study {#najran-university-case-study .unnumbered}

Alazemi et al. studied ridesharing adoption potential at Najran University, a suburban Saudi Arabian institution with limited public transit access \[35\]. The study surveyed students and staff about their commuting patterns, costs, and attitudes toward organized ride sharing. It found that over 70% of respondents traveled to campus alone by private vehicle, and that the majority expressed willingness to carpool if a trusted, convenient platform were available. Cost savings and safety assurance were the two most cited conditions for participation.

The Najran University study is the geographically closest analog to the MSEUF context: a suburban institution with poor public transit connectivity where most commuters rely on private vehicles. The finding that over 70% of solo drivers expressed willingness to carpool under the right conditions directly supports the market viability assumption of RideShareEU. The two conditions respondents cited, trust and convenience, are precisely the two design priorities that RideShareEU addresses through identity verification and algorithmic matching.

### 3.3.4.2 Peer-to-Peer Carpooling: Path to Sustainable Transportation {#peer-to-peer-carpooling-path-to-sustainable-transportation .unnumbered}

This 2025 study examined peer-to-peer carpooling programs across multiple institutional contexts and identified the structural conditions that distinguish successful implementations from unsuccessful ones \[26\]. The study found that successful programs shared three characteristics: a clear and transparent cost-sharing model, identity verification that generated trust without requiring prior social relationships, and a matching system that reduced coordination overhead to a level comparable to requesting a commercial ride.

The study explicitly identified university campuses as the most favorable deployment environment for peer-to-peer carpooling because of origin-destination concentration, schedule predictability, and the existing institutional trust infrastructure. This finding provides direct theoretical grounding for the RideShareEU project. The three success factors identified in the study map directly to three core design features of RideShareEU: the cost calculation display, the verified identity system, and the automated matching engine.

## 3.3.5 Synthesis of Related Studies {#synthesis-of-related-studies .unnumbered}

The studies reviewed in this section collectively demonstrate that the campus ride-sharing system concept is feasible, that specific design choices have documented effects on adoption and satisfaction, and that the university context is consistently identified as favorable for peer-to-peer carpooling. Table 3.1 summarizes the key parallel between each related study and RideShareEU.

The primary gap across all reviewed studies remains the absence of a complete, evaluated prototype deployed in a Philippine or broader Southeast Asian university context. All studies reviewed here were conducted in Malaysia, India, China, Saudi Arabia, or unspecified international contexts. RideShareEU fills this gap by applying the documented best practices from these studies within the specific institutional, economic, and transportation context of a Philippine university.

From a Software Engineering standpoint, the studies in Sections 3.3.1 through 3.3.5 confirm that the dominant technical contributions in the campus carpooling literature are in matching algorithm design, verified identity architecture, and web application module structure not in behavioral adoption modeling alone. RideShareEU positions itself within this technical strand: the PSGA, the three-tier architecture, and the ICTD-verified identity layer are the engineering artifacts being contributed, while the behavioral and adoption literature serves as context for the system\'s design priorities rather than as the primary intellectual focus.

# 3.4 Conceptual Framework {#conceptual-framework .unnumbered}

![](media/image3.png){width="6.0in" height="3.3229166666666665in"}*Fig. 2. IPO framework for a web-based carpool coordination system for a verified university community*

The conceptual framework follows the Input-Process-Output (IPO) model, illustrating the systematic flow of activities in developing a web-based carpool coordination system for a verified university community.

Input consists of registered users (students, faculty, and staff with verified university credentials), trip details including origin, destination, departure time and route preferences, institutional data from university identity records and academic calendar, and system configuration parameters governing matching, safety settings, and platform policies.

Process encompasses four key stages: (1) Identity Verification validating university credentials against institutional records; (2) Carpool Matching a priority-scored greedy algorithm that scores route overlap, time window compatibility, and stated preferences to generate ranked match lists; (3) Trust Formation building behavioral trust through a rating and review system while institutional endorsement establishes baseline identity trust; and (4) Real-Time Coordination delivering match notifications, suggesting meeting points, and displaying cost-split calculations to minimize coordination overhead.

Output delivers the study's contributions: confirmed matched carpool rides with route and cost details, individual commuting cost savings per completed ride, a reduction in individual fuel costs through shared trips, and a contribution toward fewer solo vehicle trips within the campus commuter pool.

## 3.4.1 Input Variables {#input-variables .unnumbered}

The framework identifies three categories of inputs that shape the system\'s operation. The first category is user characteristics, which include commuting distance, vehicle ownership status, schedule regularity, and prior experience with ride-sharing platforms. These characteristics determine which users are viable candidates for carpooling and what features will most directly address their barriers to participation.

The second category is institutional context. RideShareEU operates within a university that maintains official identity records for all students, faculty, and employees. This institutional context provides the verified identity infrastructure that commercial platforms cannot replicate. The university\'s physical location, its relationship to the surrounding residential areas, and its academic calendar all define the spatial and temporal parameters of the matching problem.

The third category is platform design inputs: the specific features, interface choices, and algorithmic decisions built into RideShareEU. These include the verified identity mechanism, the recurring trip posting model, the priority-scored greedy matching algorithm, the cost calculation display, and the safety features. Each design input is derived from the empirical findings reviewed in Sections 3.2 and 3.3.

## 3.4.2 Process Variables {#process-variables .unnumbered}

The core process of the system is the matching cycle. A ride host posts a recurring trip specifying origin, route, departure time, available seats, and preferences. A passenger submits a search request with compatible parameters. The matching algorithm evaluates route overlap, schedule compatibility, and stated preferences to generate a ranked list of candidate rides. The user confirms a selection. The system records the match and notifies both parties.

Trust formation is a parallel process. At registration, the verified identity mechanism establishes baseline identity trust. As users accumulate shared rides, behavioral trust builds through the rating and review system. Institutional trust is established at the platform level through the university\'s endorsement and access control policy. The framework posits that trust formation is a prerequisite for the matching process to produce completed rides rather than cancelled arrangements.

## 3.4.3 Output Variables {#output-variables .unnumbered}

The immediate outputs of the system are confirmed ride host-rider arrangements, measured as completed trip matches with route and fuel share details. The primary deliverable is a functional web-based prototype evaluated against technical functionality, usability standards, and initial user satisfaction. Secondary outputs include system testing results and user feedback data collected during the evaluation phase.

## 3.4.4 Moderating Variables {#moderating-variables .unnumbered}

The relationship between platform features and adoption outcomes is moderated by several variables identified in the literature. Perceived safety risk moderates the effect of cost and convenience benefits on adoption intention \[9\]. Users who perceive high safety risk do not respond to economic or convenience appeals until safety concerns are addressed. This moderating relationship means that the safety features of RideShareEU, specifically the verified identity display and the GPS tracking option, must be prominent in the interface before the cost calculator and match suggestions become effective[Projects](https://claude.ai/projects)

motivators.

Gender moderates the effect of safety features on reported satisfaction \[6\], \[10\]. Female users show larger satisfaction gains from safety features than male users. This does not mean safety features are unnecessary for male users, but it does mean that safety communication should be designed with female users as the primary audience. Social norms moderate the effect of individual attitudes on behavioral intention \[6\]. Users who believe their peers carpool are more likely to act on positive individual attitudes. The platform\'s community activity display is the design feature that addresses this moderating variable.

## 3.4.5 Framework Summary {#framework-summary .unnumbered}

The conceptual framework positions RideShareEU as a system that converts the institutional trust infrastructure of a university into a functional carpooling market. The university\'s verified identity records reduce the trust barrier that the literature identifies as the primary obstacle to ride-sharing adoption. The algorithmic matching engine reduces the coordination barrier. The cost display converts abstract savings into a concrete motivator. The safety features neutralize the risk perceptions that block adoption even among users who find the economic case compelling.

The evaluation phase of RideShareEU tests this through controlled user testing of the functional prototype, focusing on match quality, interface usability, and user satisfaction within the MSEUF community. The evaluation phase of RideShareEU tests this prediction through controlled user testing and post-deployment surveys.

From a software engineering traceability perspective, each IPO stage maps to a specific set of system modules and measurable outputs. The Input stage corresponds to the Authentication Module (ICTD verification) and the Profile Module (preference storage). The Process stage maps to the PSGA Matching Service (filter + score + rank), the Notification Service (match alerts and reminders), and the Fuel Share Calculator (cost split display). The Output stage maps to the Match Confirmation Module (approved ride with fuel share), the Rating Module (post-trip scores), and the Trust Score Module (running average update). Each module can be independently tested against a defined acceptance condition, making the conceptual framework directly traceable to the test plan in Section 5.1.5.

# 3.5 Definition of Terms  {#definition-of-terms .unnumbered}

**Carpool / Carpooling.** This refers to an arrangement in which two or more people share a private vehicle trip, with costs split among passengers. The vehicle is owned by one participant who would have made the trip regardless of the arrangement. \[1\], \[2\], \[40\].

**Ride Sharing.** This refers to the broader practice of multiple people sharing a vehicle for overlapping trips. In this study, used interchangeably with carpooling in the context of peer-to-peer, non-commercial trip sharing. \[2\], \[8\], \[44\].

**Peer-to-Peer (P2P) Ride Sharing.** This refers to a ride-sharing model in which private individuals directly arrange shared trips with one another, without a professional driver or commercial vehicle. Cost sharing covers expenses only, not profit. \[1\], \[40\], \[41\].

**Matching Algorithm.** This refers to a computational procedure that identifies compatible ride host and rider pairs from a pool of registered users, based on criteria such as route overlap, departure time proximity, and stated preferences. In RideShareEU, implemented as a priority-scored greedy algorithm. \[1\], \[12\], \[14\], \[17\].

**Priority-Scored Greedy Algorithm.** This refers to the two-stage matching algorithm used in RideShareEU. In the first stage, it filters available trips by route overlap percentage and schedule compatibility. In the second stage, it scores and ranks the filtered candidates using stated user preferences, selecting the highest-scoring match available at the time of the request. \[12\], \[14\].

**Fuel Share.** This refers to the voluntary contribution a passenger makes toward the ride host's fuel cost for a shared trip. It is not a fare or a commercial payment. The amount is suggested by the system based on distance and split among all passengers and is settled directly between users outside the platform. \[2\], \[40\].

**Ride Host.** This refers to a verified university community member who owns a private vehicle and posts a recurring trip on RideShareEU, offering available seats to other verified members traveling along a compatible route. Distinct from a commercial driver, the ride host earns no profit and shares only the cost of a trip they would already be making. \[12\], \[40\].

**Insertion Heuristic.** This refers to an approximation algorithm for vehicle routing problems that inserts new requests into existing routes at the point of minimum additional cost, typically measured as detour distance. \[1\].

**Route Overlap.** This refers to the proportion of a passenger\'s travel path that coincides with a driver\'s planned route. A higher route overlap percentage indicates a more compatible match with lower detour cost for the driver. \[11\], \[12\], \[13\].

**Recurring Trip.** This refers to a trip that repeats on a defined schedule, such as a commute to campus every morning. Distinct from a single-trip request, which covers only one journey. \[1\], \[14\].

**Verified Identity / Identity Verification.** This refers to a process by which a platform confirms that a registered user is who they claim to be, typically by validating credentials against an authoritative record such as a university student information system. \[4\], \[5\], \[10\].

**Trust (in ride-sharing context).** This refers to a user\'s willingness to enter a shared vehicle arrangement based on confidence in the co-rider\'s identity, behavior, and the platform\'s reliability. Comprises identity trust, behavioral trust, institutional trust, and platform security trust. \[2\], \[4\], \[5\].

**Technology Acceptance Model (TAM).** This refers to a theoretical framework proposing that perceived usefulness and perceived ease of use are the primary determinants of a user\'s intention to adopt a new information technology. \[6\].

**Theory of Planned Behavior (TPB).** This refers to a behavioral theory proposing that intention to perform a behavior is shaped by personal attitudes, subjective norms (perceptions of peer behavior), and perceived behavioral control. \[6\].

**Semicentralized Matching.** This refers to a matching strategy in which the platform generates a set of compatible candidate matches and presents them to users for confirmation, rather than either assigning matches automatically or requiring users to find partners without algorithmic assistance. \[16\].

**Space-Time Clustering.** This refers to a pre-processing technique that groups users by shared departure time windows and geographic proximity before applying a matching algorithm, reducing the computational cost of finding compatible pairs. \[18\].

**Meeting Point.** This refers to a designated location where a passenger boards or alights from a shared vehicle, which may differ from the passenger\'s precise home address. Meeting points are typically selected to minimize driver detour while keeping passenger walking distance acceptable. \[28\], \[29\].

**Web Application.** This refers to a software application that runs in a web browser and is accessed over a network, without requiring installation on the user\'s device. Functionality is delivered through a combination of server-side processing and browser-rendered interfaces. \[3\], \[26\], \[27\].

**RESTful API.** This refers to a software architectural style for networked applications in which client and server communicate through standard HTTP methods. A RESTful API exposes system functionality as addressable resources accessible via URLs. \[26\].

**Three-Tier Architecture.** This refers to a software design pattern that separates an application into three logical layers: a presentation layer that handles user interface, a business logic layer that processes operations and rules, and a data layer that manages persistent storage. \[3\].

**Stable Matching.** This refers to a matching outcome in which no unmatched pair of participants would both prefer each other over their current partners. Derived from Gale-Shapley stable matching theory applied to two-sided preference markets. \[17\].

**Thin Market.** This refers to a market condition in which the number of active participants is too low to generate reliable matches, resulting in frequent failures to find compatible pairs and driving users to abandon the platform. \[40\], \[41\].

**Conceptual Framework.** This refers to a structured representation of the key concepts, variables, and relationships that define how a study\'s subject matter is understood and how the research is expected to produce its outcomes. \[4\], \[5\].

# 3.6 Acronyms {#acronyms .unnumbered}

The following acronyms are used throughout this thesis:

**API** -- Application Programming Interface. A set of protocols and definitions that enables software components to communicate and share data, used in RideShareEU to connect the frontend interface with the backend matching engine \[26\].

**GPS** -- Global Positioning System. A satellite-based navigation system used in RideShareEU's optional real-time tracking safety feature to allow shared ride participants to monitor trip progress \[10\].

**IPO** -- Input-Process-Output. A systems model used in Section 3.4 to organize and present the conceptual framework, mapping the platform's inputs, processing activities, and deliverable outcomes.

**PSGA** \-- Priority-Scored Greedy Algorithm. The two-stage matching algorithm used in RideShareEU. The first stage filters candidate trips by route overlap and schedule compatibility. The second stage ranks the filtered results by stated user preferences and selects the highest-scoring available match. \[12\]\[14\].

**P2P** -- Peer-to-Peer. A model in which private individuals directly arrange shared trips without a professional driver or commercial vehicle, as used throughout the RRL to describe RideShareEU's operational model \[1\], \[40\], \[41\].

**REST / RESTful** -- Representational State Transfer. A software architectural style for networked applications in which client and server communicate through standard HTTP methods. Referenced in Section 3.2.4.3.1 to describe the API architecture of campus ride-sharing applications \[26\].

**SCM** -- Semicentralized Ride-Matching. A matching strategy in which the platform generates a ranked list of compatible matches and presents them to users for confirmation, preserving user autonomy while reducing search effort. Described in Section 3.2.3.4.1 \[16\].

**TAM** -- Technology Acceptance Model. A theoretical framework proposing that perceived usefulness and perceived ease of use are the primary determinants of a user's intention to adopt a new informationtechnology. Applied in Section 3.2.9.1.1 to guide RideShareEU's interface design priorities \[6\].

**TPB** -- Theory of Planned Behavior. A behavioral theory proposing that intention to perform a behavior is shaped by personal attitudes, subjective norms, and perceived behavioral control. Applied in Section 3.2.9.1.2 to justify the social proof features included in RideShareEU \[6\].

**UI** -- User Interface. The visual and interactive elements through which users interact with a software application. Referenced throughout the study in the context of RideShareEU's design requirements for cost display, match presentation, and safety feature visibility \[3\], \[26\].

**URL** -- Uniform Resource Locator. A reference to a web resource specifying its location on a computer network. Used in the RESTful API architecture of RideShareEU to address system resources accessible through standard HTTP methods \[26\].

# Operational Framework

## Materials

### Software Requirements/ Constraints

Table I lists the software tools used to develop and deploy RideShareEU, along with the specification and purpose of each tool.

**TABLE I**

**SOFTWARE TOOLS**

  ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Software**         **Specifications**       **Purpose**
  -------------------- ------------------------ ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  Figma                Version 126.0.4          UI/UX prototyping tool used to design all interface screens before development begins. The prototype serves as the visual specification that guides frontend coding and ensures all screens match the approved design before implementation.

  Visual Studio Code   Version 1.85+            Primary code editor for writing, debugging, and testing all frontend and backend code. Extensions for ESLint, Prettier, and REST support consistent code quality across the team.

  Node.js              Version 20.x LTS         JavaScript runtime for the backend API server. Node.js 20 is the current long-term support release, which provides stability for the twelve-month development cycle. All API routes, matching logic, notification dispatch, and authentication services run on this runtime.

  Python               Version 3.10 or higher   Used for developing and unit-testing the Priority-Scored Greedy Algorithm before integrating it into the Node.js backend. Python\'s numerical libraries support rapid prototyping of the scoring formula and weight calibration.

  MySQL / PostgreSQL   Version 8.0+             Relational database for storing user profiles, trip records, match histories, ratings, and preference settings. A relational model is required because of the structured relationships between users, trips, and matches that the matching algorithm queries.

  Next.js              Version 14.x             React framework for the frontend web application. Next.js provides server-side rendering for faster initial page loads and client-side routing for seamless navigation between Dashboard, My Trips, Notifications, and Profile screens without full page reloads.

  Vercel               Version 50.34.3          Cloud deployment platform for the Next.js frontend. Vercel provides automatic HTTPS, continuous deployment from the Git repository, and global CDN distribution. Zero-configuration setup reduces deployment overhead for the team.

  Jest                 Version 29.x             JavaScript testing framework for unit and integration testing. Jest tests individual API endpoints, the PSGA matching service, and the fuel share calculation function in isolation before full system integration testing.

  Postman              Latest version           API testing and documentation tool. Postman validates all REST endpoints including registration, trip creation, match generation, notification dispatch, and rating submission across all expected and edge-case inputs.

  Git                  Version 2.40+            Version control system for all source code. Git tracks changes across the team, supports branching for parallel feature development, and integrates with Vercel for automatic deployment on merge to the main branch.

  Trello / Notion      Web-based                Kanban board for continuous backlog management, task assignment, and workflow tracking. The board provides the visual continuous pull system used in the pure Kanban architecture described in Section 5.
  ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

**Technology Choice Justification:** Python to Node.js: The use of Python for initial PSGA development and Node.js for production integration is a deliberate two-phase engineering decision, not a workflow convenience. In Phase 1, the PSGA scoring formula, weight configuration, and edge-case behavior are developed and unit-tested entirely in Python, isolated from the API server. This allows the algorithm to be validated as a standalone computational artifact ts correctness is confirmed before any web application code depends on it. In Phase 2, the validated logic is ported to Node.js so the production system has no cross-language service boundary, no inter-process latency, and no runtime dependency on a Python environment alongside the Node.js server. Keeping one runtime in production reduces deployment complexity and eliminates a failure point. This two-phase pattern prototype and validate in a numerically expressive language, then re-implement in the production runtime is a recognized software engineering practice for embedding computational components into web services.

**Software constraint:** The entire frontend must run in a standard browser without any client-side installation. This rules out desktop-only frameworks. Next.js with Vercel deployment meets this constraint for all major browsers on desktop and mobile.

### Hardware Requirements/ Constraints

Table II lists the hardware used during development and testing. Each machine handles a specific workstream to keep parallel development moving without resource conflicts.

**TABLE II**

**HARDWARE TOOLS**

  ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Hardware**             **Specifications**                                               **Purpose**
  ------------------------ ---------------------------------------------------------------- ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  Development Server 1     CPU: AMD Ryzen 5 5600X RAM: 16GB DDR4 3200MHz Storage: 1TB SSD   Primary workstation for backend algorithm development and load testing. The 5600X runs the PSGA algorithm benchmarking and hosts the backend server during integration testing. 1TB storage accommodates larger test datasets and build artifacts.

  Development Server 2     CPU: AMD Ryzen 3 4100 RAM: 8GB DDR4 Storage: 256GB SSD           Secondary machine for frontend Next.js development, database schema work, and parallel image processing workflows. Dedicated to frontend tasks to avoid blocking backend development on the primary machines.

  Development Server 3     CPU: AMD Ryzen 3 4100 RAM: 8GB DDR4 Storage: 256GB SSD           Secondary machine for frontend Next.js development, database schema work, and parallel image processing workflows. Dedicated to frontend tasks to avoid blocking backend development on the primary machines.

  Laptop 1                 CPU: Apple M4 RAM: 12GB Storage: 256GB                           Portable workstation for team meetings, code reviews, and frontend testing across different viewport sizes. The M4 chip allows battery-efficient remote work and real-device browser testing on macOS Safari, which desktop Linux machines cannot replicate.

  Network Infrastructure   Stable internet, minimum 10 Mbps                                 Required for team collaboration through Git, live API testing against the deployed Vercel frontend, Postman cloud syncing, and continuous deployment pipeline execution. Minimum 10 Mbps sustains simultaneous upload and download during active deployment cycles.
  ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

**Hardware constraint:** The system is a web application. End users need only a device with a modern browser and an internet connection. No specific end-user hardware is mandated. The minimum 10 Mbps network constraint applies to the development team, not to end users. The value of the hardware configuration is not the individual machine specifications but the workflow separation it enables: the primary development server (AMD Ryzen 5 5600X) handles PSGA benchmarking and backend load testing in isolation from the frontend and integration work running on the secondary machines, reducing interference between parallel development streams.

### Data 

RideShareEU uses four categories of data during development and operation.

**User data** comes from the university ICTD database and the school email system. This includes student and employee identification numbers, full names, institutional email addresses, and role classification as Student, Faculty, or Staff. User data is not collected manually. At registration, the system validates the submitted institutional email against the ICTD records. Only accounts with a confirmed match gain platform access. No additional personal data collection is required from users beyond the institutional email.

**Trip data** is user-generated. Ride hosts submit trip posts specifying origin location, destination, departure time, recurrence type, vehicle make and model, vehicle color, and available seat count. Passengers submit search requests specifying origin, destination, preferred departure time, and flexibility window. This data is entered directly through the platform interface and stored in the relational database.

**Match data** is system-generated. The PSGA engine creates match records at the time of each successful filter and scoring operation. Each record stores the trip ID, passenger ID, computed score, approval status, fuel share amount, and timestamps for creation and completion.

Validation Dataset. For algorithm validation, a synthetic dataset is generated independently of the live application. Synthetic trips are constructed using origin-destination pairs drawn from the known residential clusters of MSEUF commuters along the Lucena City corridor for example, barangays such as Ibabang Dupay, Gulang-Gulang, and Ilayang Dupay as common origin zones with the MSEUF campus as the fixed destination. Departure times are distributed across the two daily peak windows: 6:00--8:30 AM (morning arrival) and 4:00--6:30 PM (afternoon departure). Route overlap values, time differentials, and preference settings are deliberately parameterized to cover the full scoring range, including edge cases such as zero route overlap, exact schedule alignment, and conflicting gender preference constraints. Ground truth labels are assigned by two human evaluators who independently classify each passenger-trip pair as an acceptable or unacceptable match using a structured rubric specifying minimum route overlap, maximum schedule gap, and preference satisfaction conditions. Pairs where the two evaluators disagree are resolved by a third reviewer. A key limitation is that synthetic trips may not fully capture real commuting diversity, irregular schedules, multi-stop routes, and semester-to-semester variation are not represented. This limitation is acknowledged in the evaluation section.

**Preference data** is user-specified through the Profile and Preferences screen. Users set co-rider gender preference, departure time flexibility window in minutes, and the Familiar Riders Only toggle. These preferences are stored per user and applied as default parameters in all subsequent trip posts and passenger searches.

All data handling follows Republic Act 10173, the Data Privacy Act of 2012. Personally identifiable information is encrypted at rest in the database and in transit over HTTPS. Access to user records is restricted to authenticated sessions. No user data is shared with third parties.

# Description of Methods or Approach

![](media/image4.png){width="6.0in" height="3.375in"}*Fig. 3. Kanban Architecture*

The Kanban board consists of four columns: **Ready**, **Development**, **Test**, and **Done**. To maintain a continuous flow of delivery, strict Work-In-Progress (WIP) limits are applied. The Development column has a WIP limit of 3, and the Test column has a WIP limit of 2. These constraints prevent bottlenecks and stop work from piling up at any single stage. The system operates on a pure pull mechanism; tasks are pulled from the Backlogs repository which holds trip module tasks, algorithm issues, UI components, and test cases into the Ready column only when the team has open capacity. Applied to RideShareEU, this methodology keeps identity verification, matching algorithm development, web application work, and API integration moving continuously, prioritizing cycle time reduction over the administrative overhead of batched releases or fixed sprints.

.

### Requirements Definition

*5.1.4 Data Analysis and Coding Method*

**Identity verification.** At registration, the system sends a verification link to the submitted institutional email. The backend queries the ICTD database to confirm the email belongs to an active university member. Only verified accounts gain access. Role classification is extracted from the ICTD record and stored in the user profile.

**Trip data coding.** Each trip record stores host user ID, origin and destination coordinates, departure time, recurrence type, total seat count, filled seat count, vehicle information, and trip status. Route overlap between a trip and a passenger request is computed using the geographic coordinates of both origin-to-destination pairs.

**Match scoring.** The PSGA produces a numeric score for each candidate trip as a weighted sum of route overlap percentage, schedule alignment accuracy, and preference compatibility. Route overlap is the proportion of the passenger route covered by the host route. Schedule alignment is derived from the absolute time difference normalized against the flexibility window. Preference compatibility checks gender preference and the familiar-riders-only setting.

**Rating and trust.** After each completed trip, both parties submit a rating from 1 to 5. The system updates each user\'s cumulative trust score using a running average across all received ratings. The score and total trip count display on the public profile.

**Coding approach.** The backend API uses Node.js with a RESTful architecture. Each resource has dedicated endpoint groups. Input validation runs on all POST and PUT requests before any database write. The PSGA matching logic is isolated in a dedicated service module, separately unit-tested from the API layer. The frontend uses Next.js with component-level state management. All inter-tier communication uses JSON over HTTPS.

### Functional Requirements

1\. Verified university member registration using institutional email credentials from the ICTD database.

2\. Trip posting by ride hosts with origin, destination, departure time, recurrence pattern, vehicle information, and seat count.

3\. Trip search and join requests from passengers with compatible route and schedule parameters.

4\. A priority-scored greedy algorithm that filters trips by route overlap and time window, then ranks filtered results by route overlap weight, schedule alignment weight, and preference compatibility weight.

5\. A trust and rating system where both parties rate each other after a completed trip.

6\. A real-time notification system for match requests, approvals, trip reminders, and rating prompts.

7\. A fuel share display showing the suggested per-passenger contribution for each matched trip.

### Non-functional Requirements

1\. Match generation response time is less than two seconds.

2\. Secure handling of university identity data in compliance with Republic Act 10173.

3\. A mobile-responsive web interface is accessible through any modern browser without installation.

4\. System availability of at least 99% during academic term periods.

The functional and non-functional requirements above are derived from three sources: the stakeholder needs analysis conducted with prospective MSEUF users, the literature-identified minimum feature set for campus carpooling systems (Sections 3.3.1--3.3.2), and the ISO/IEC 25010 quality model applied to web-based systems. Each requirement is stated in testable form it specifies what the system must do or achieve, not how it is implemented allowing each requirement to be independently verified during the testing phase in Section 5.1.5.

**5.1.3.1 Requirements Traceability Matrix**

To ensure rigorous software engineering validation, the system\'s functional requirements are mapped directly to their corresponding software modules, API endpoints, and ISO/IEC

25010 evaluation metrics.

  -------------------------------------------------------------------------------------------------------
  **Requirement ID**           **Use Case / Module**   **Target API Endpoint**   **ISO 25010 Metric**
  ---------------------------- ----------------------- ------------------------- ------------------------
  FR1: Verified Registration   Authenticate via ICTD   POST /api/auth/verify     Security

  FR2: Trip Posting            Manage Trips (Host)     POST /api/trips           Functional Suitability

  FR4: PSGA Algorithm          Run PSGA Engine         GET /api/matches          Performance Efficiency

  FR6: Notifications           Send Notification       POST /api/alerts          Usability
  -------------------------------------------------------------------------------------------------------

### 5.1.4 Design Architecture of the System {#design-architecture-of-the-system .unnumbered}

RideShareEU uses a three-tier architecture. The presentation layer runs on Next.js 14.x. The business logic layer is a Node.js API server handling matching, identity verification, notification dispatch, and fuel share computation. The data layer is a relational database storing users, trips, matches, ratings, and preferences. Module decoupling is a key architectural concern. The PSGA engine is isolated as a dedicated service module with a strictly defined input contract: it accepts a passenger search request object and a list of candidate trip records and returns a ranked list of scored matches. It has no direct dependency on the HTTP routing layer, the database connection pool, or the notification service. This isolation means the PSGA can be unit-tested completely independently from the rest of the system, updated or replaced without touching the API layer, and re-implemented in a different language without requiring changes to any surrounding module. The API layer calls the PSGA service as an internal function call. The UI layer never directly invokes matching logic. This separation of concerns is enforced as an architectural rule throughout development.

*5.1.2.1 Class Diagram*![](media/image5.png){width="6.110160761154856in" height="3.3191491688538934in"}

*Fig. 4 Class Diagram*

The class diagram defines eight classes. User is the central entity storing identity, role, and trust rating. Trip is owned by a User acting as host and holds all route, schedule, and vehicle attributes. Match links a Trip to a passenger User and records the PSGA score, status, and fuel share. Notification associates with a User and carries alert type and read status. Preference is a one-to-one extension of User storing default matching settings. Rating links to a completed Match and records rater, ratee, and score. PSGA is a service class with filter, score, and rank methods. Vehicle stores registered vehicle details used in trip\
post. 5.1.2.2

*Use Case Diagram*

![](media/image6.png){width="5.802179571303587in" height="5.375024059492564in"}*Fig. 5 Use Case Diagram*

Two primary actors interact with the system: a university member as Ride Host and a university member as Passenger. A System actor represents automated processes. Both host and passenger share the Register use case, which includes institutional credential verification as a dependency. The host covers posting trips, managing trips, approving or declining join requests, rating passengers, and viewing notifications. The passenger covers searching for rides, submitting join requests, viewing match details with fuel share, and rating hosts. The System actor drives the PSGA engine and notification dispatch, which other use cases trigger as includes.

*5.1.2.3 Sequence Diagram*

![](media/image7.png){width="4.57298009623797in" height="4.415671478565179in"}

*Fig. 6 Sequence Diagram*

The sequence diagram covers three phases. In Trip Search and Matching, the passenger submits a search through the frontend, the API forwards it to the PSGA engine, the PSGA queries the database and returns ranked matches, and the frontend displays results. In Join Request and Approval, the passenger submits a join request, the API creates a match record and notifies the host, the host approves, and the API updates the match status and notifies the passenger with fuel share details. In Post-Trip Rating, the passenger submits a rating, the API saves it and updates the host trust score, and the frontend displays the updated score.

*5.1.2.4 Activity Diagram*

![](media/image8.png){width="3.267442038495188in" height="4.778862642169729in"}

*Fig. 7 Activity Diagram*

The activity diagram traces the full user journey. The user opens RideShareEU. If not registered, the flow goes to institutional email registration. After login, the flow splits by role. Hosts post a trip, receive a join request notification, and approve or decline. Passengers search for rides, view ranked PSGA matches, and submit a join request. Both branches merge at the trip proceeding on the scheduled date. After completion, the system marks the trip as done, sends rating prompts, both parties submit ratings, and trust scores update.

*5.1.2.5 Algorithm*

![](media/image9.png){width="3.2916666666666665in" height="6.0in"}

Fig. 8 Priority-Scored Greedy Algorithm (PSGA)

The PSGA is a two-stage greedy algorithm. It selects the best available trip for a Passenger request at the time of the request without revisiting earlier decisions. This greedy structure fits the RideShareEU context for two reasons. First, university commutes are scheduled in advance. The trip pool at any query time is fully observable, not dynamically arriving. Second, the community is bounded. The university population is finite, which keeps the candidate set tractable for real-time matching within a two-second response constraint.

A globally optimal matching approach, such as the stable roommates or Hungarian algorithm, would require holding requests in a queue and solving a batch assignment across all pending passengers simultaneously. This is unsuitable for a platform where Ride Hosts post trips on their own schedules and Passengers search independently. The greedy approach provides immediate results with deterministic behavior. A Passenger submits a request and receives a ranked list of matches in a single operation. It is important to be precise about what the PSGA claims and does not claim. It does not assert global optimality it does not guarantee that the simultaneous assignment of all passengers across all available trips at any given moment is the mathematically best possible allocation. Proving global optimality would require a batch assignment formulation such as the Hungarian algorithm or stable matching, which requires holding all passenger requests in a queue and solving them together. This is unsuitable for an asynchronous platform where hosts post trips and passengers search independently at different times. The PSGA claims practical suitability: for a bounded, fully observable trip pool with independent per-passenger queries, greedy selection with a weighted composite score is fast, deterministic, and produces results validated against match acceptance rate. The distinction between practical suitability and global optimality is maintained precisely throughout this manuscript.

**How the Algorithm Works**

## Stage 1: Filtering {#stage-1-filtering .unnumbered}

The filter stage removes candidate trips that cannot satisfy the Passenger\'s basic requirements. It applies to two independent predicates in sequence. A trip must pass both to advance.

**Filter 1: Route Overlap.** The system computes the geographic overlap between the Passenger\'s origin-to-destination route and each Open trip\'s host route. Overlap is measured as the proportion of the Passenger\'s path that falls within a tolerance corridor of the host\'s path. Formally:

RouteOverlap(P, H) = \|segment(P) intersect corridor(H)\| / \|segment(P)\|

Any trip with RouteOverlap below the configured minimum threshold is discarded. The threshold is a system parameter set during calibration. Setting it too high eliminates valid near-route matches. Setting it too low introduces trips that require the Passenger to travel significantly out of direction.

**Filter 2: Schedule Compatibility.** The system computes the absolute time difference between the Passenger\'s preferred departure time and the host trip\'s scheduled departure time. Any trip whose time difference exceeds the Passenger\'s stated flexibility window in minutes is discarded. Formally:

TimeDiff(P, H) = \|DepartureTime(P) - DepartureTime(H)\| \<= FlexWindow(P)

The flexibility window is a user-set preference stored in the Passenger\'s profile. The default is 15 minutes. Users adjust it on the Profile and Preferences screen before or during a search.

## Stage 2: Scoring {#stage-2-scoring .unnumbered}

Each trip that passes both filters receives a composite score. The score is a weighted sum of three components, each normalized to the range \[0, 1\].

Score(P, H) = (w1 x RouteOverlap) + (w2 x ScheduleAlignment) + (w3 x PreferenceMatch)

**RouteOverlap.** The value computed in Stage 1, expressed as a decimal from 0.0 to 1.0. A RouteOverlap of 1.0 means the Passenger\'s full path is covered by the host route.

**ScheduleAlignment.** Computed as 1 minus the normalized time difference within the flexibility window. A time difference of 0 minutes produces a ScheduleAlignment of 1.0. A time difference equal to the full flexibility window produces a ScheduleAlignment of 0.0. Formally:

ScheduleAlignment = 1 - (TimeDiff / FlexWindow)

**PreferenceMatch.** A binary value. It is 1.0 if all hard preference constraints are satisfied and 0.0 if any single constraint fails. Hard constraints include: co-rider gender preference, the Familiar Riders Only toggle, and available seat count being greater than zero. PreferenceMatch is evaluated as a conjunction. All constraints must pass for the value to be 1.0.

The weights w1, w2, and w3 are system parameters that sum to 1. Default values are set at w1=0.5, w2=0.3, w3=0.2, reflecting that geographic compatibility is the primary matching criterion for recurring campus commutes. These weights are adjustable during the testing phase based on user acceptance data.

Baseline Comparison Justification

The PSGA is evaluated against three simpler baseline approaches to demonstrate its comparative value over readily available alternatives.

Baseline 1 Random Ranking: Trips that pass Stage 1 filtering are presented in random order with no scoring applied. This is the lowest-effort implementation and establishes the floor for match acceptance rate.

Baseline 2 Route-Only Matching: Trips are filtered and ranked by route overlap percentage alone, ignoring schedule alignment and user preferences. This tests whether the additional scoring dimensions of the PSGA contribute meaningful improvement over pure geographic proximity matching.

Baseline 3 FIFO Listing: Trips are presented in the order they were posted, with no filtering or scoring. This represents the default behavior of an unranked trip board and is the most common pattern in general-purpose ride boards.

The PSGA is expected to outperform all three baselines on precision at rank 1 meaning the top result shown to the passenger is more frequently an acceptable match. The validation phase in Section 5.1.2.5 measures and reports this comparison explicitly.

## Ranking and Output {#ranking-and-output .unnumbered}

All scored candidates sort in descending order by Score. The top-ranked trip is presented as the primary match. Remaining candidates display as alternatives with their scores and fuel share contributions shown. If no trips pass Stage 1, the system returns a no-match notification to the Passenger.

The entire two-stage operation executes in a single transaction against the database. All trips with status Open and available seats greater than zero are retrieved, filtered, and scored in one pass. This O(n) time complexity per query, where n is the number of open trips, satisfies the two-second response requirement for the bounded university community population. For a university of 10,000 registered users with an estimated concurrent trip pool of 200 to 500 open trips, the match operation completes in well under one second on standard server hardware.

## Algorithm Pseudocode {#algorithm-pseudocode .unnumbered}

FUNCTION PSGA(passenger_request):

> candidates \<- GET all trips WHERE status=Open AND seats\>0
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
> IF overlap \>= MIN_OVERLAP AND timeDiff \<= passenger_request.flexWindow:
>
> filtered.append(trip)
>
> IF filtered is empty: RETURN no_match
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

The fuel share amount displayed at match confirmation is computed as a separate function called after the PSGA produces a match. It estimates the per-passenger cost contribution for the matched trip segment.

FuelShare = (DistanceKm / FuelEfficiency) x FuelPricePerLiter / (1 + FilledSeats)

DistanceKm is the estimated driving distance of the matched route segment. FuelEfficiency is drawn from the vehicle record submitted by the Ride Host. FuelPricePerLiter is a configurable system parameter updated to reflect current Philippine fuel price advisories. FilledSeats is the current occupancy at the time of match. The result is a peso amount the Passenger contributes to the host for that trip. This figure is informational. Payment is arranged directly between the parties outside the platform.

## Complexity and Performance Targets {#complexity-and-performance-targets .unnumbered}

**TABLE III**

  --------------------------------------------------------------------------------------------------------------------
  **Metric**                  **Target**                        **Basis**
  --------------------------- --------------------------------- ------------------------------------------------------
  Time complexity per query   O(n) where n = open trips         Single-pass filter and score over candidate set

  Match generation time       \< 2 seconds                      Non-functional requirement; verified by load test

  Concurrent query handling   Up to 200 simultaneous requests   Estimated peak load at class schedule transitions

  Score precision             4 decimal places                  Sufficient to rank candidates with near-equal scores
  --------------------------------------------------------------------------------------------------------------------

## Algorithm Validation {#algorithm-validation .unnumbered}

The PSGA is validated separately from the web application using a synthetic dataset of 500 simulated trips drawn from address clusters around Enverga University in Lucena City. The dataset spans route distance ranges, departure time distributions, and preference combinations representative of a university commute population. Evaluation metrics are precision at rank 1 (proportion of top-ranked matches that are ground truth positives), recall across the full filtered set, and mean rank of the first acceptable match.

The ground truth oracle is defined as follows: for each of the 500 passenger-trip pairs in the synthetic dataset, two human evaluators independently assess whether the pair constitutes an acceptable match based on the stated route, schedule, and preference Sparameters. A pair is labeled a ground truth positive only if both evaluators agree it is acceptable. Disagreements are resolved by a third evaluator acting as tiebreaker. Evaluators are given a structured rubric specifying acceptable route overlap ranges, schedule gap tolerances, and preference satisfaction conditions to minimize subjective variation. This oracle definition is fully documented and reproducible, allowing future researchers to re-evaluate the PSGA against the same ground truth using different scoring weights. Results are reported alongside the ISO/IEC 25010 system evaluation and the three-baseline comparison described in the preceding section.

# B. Description of Methods or Approach {#b.-description-of-methods-or-approach .unnumbered}

## Development Methodology {#development-methodology .unnumbered}

RideShareEU follows a Kanban software development methodology. Kanban employs a continuous pull system. This system supports parallel workstreams better than fixed length iterations.

The board divides tasks into Ready, Development, Testing, and Done. The framework applies Work In Progress limits. These limits prevent bottlenecks between algorithmic validation, backend API construction, and frontend UI design. They support the integration of user profile and notification screens.

The methodology organizes the pull system across six artifact categories. The categories include literature and requirements, architecture and design, PSGA prototype, API integration, frontend components, and test cases.

Work In Progress limits act as an engineering control. They stop the algorithm development stream from blocking API integration. They prevent incomplete frontend components from entering the testing phase before API endpoint verification.

This delivery model lets the team validate the PSGA engine in isolation. The team integrates engineering improvements without blocking presentation layer development. Examples include refining the PSGA service interface, tightening API input validation, and adding test coverage for edge cases.

## Data Gathering Procedure {#data-gathering-procedure .unnumbered}

### **a. Comprehensive Discussion on Theorems and Definitions** {#a.-comprehensive-discussion-on-theorems-and-definitions .unnumbered}

The theoretical foundation of the PSGA draws from two bodies of work: greedy algorithm theory and carpool matching formulations.

A greedy algorithm makes the locally optimal choice at each step without backtracking. For carpool matching, this means selecting the highest-scoring available trip at query time rather than holding requests in a queue for batch optimization. The correctness condition for a greedy approach applies when the local optimum at each step does not prevent a globally acceptable solution. In a bounded university community where trips are posted in advance and Passengers search independently, each query is independent. The greedy choice for one Passenger does not block a valid match for another Passenger asking for a different route.

The route overlap computation draws from computational geometry. The segment intersection method used by PSGA computes whether a Passenger\'s origin-to-destination path falls within a tolerance corridor of the host route, using projected coordinates. This approach is a simplification of full map-matching but sufficient for the scale of a single university campus and its surrounding residential clusters.

### **b. Fundamental Algorithms** {#b.-fundamental-algorithms .unnumbered}

The PSGA is implemented in two stages as described in Section 5.1.2.5. The following supporting algorithms are used within the system.

**Route Overlap Computation.** The system uses a line segment approximation of both the Passenger and host routes using Google Maps Directions API waypoints. Overlap is computed as the fraction of the Passenger route that falls within a 500-meter corridor of the host route using Haversine distance calculations between sampled points. This replaces a full polygon intersection approach, which is computationally heavier and unnecessary at the scale of city-level driving routes.

**Fuel Share Calculation.** A direct arithmetic formula computes the per-passenger fuel contribution as described in Section 5.1.2.5. No machine learning or optimization is involved. The inputs are the trip distance, the vehicle fuel efficiency from the host\'s vehicle record, the current fuel price parameter, and the seat occupancy count at match time.

**Trust Score Update.** After each completed trip, both the Ride Host and the Passenger submit a rating from 1 to 5. The system updates each user\'s cumulative trust score as a running average over all received ratings. The formula is: TrustScore = (PreviousAverage x TripCount + NewRating) / (TripCount + 1). This avoids storing all individual ratings in a query at read time.

### **c. Mathematical Models and Formulas** {#c.-mathematical-models-and-formulas .unnumbered}

The core mathematical model of the system is the PSGA scoring formula. The complete set of formulas used in the system are documented below for reference.

**TABLE IV**

  ----------------------------------------------------------------------------------------------------------------
  **Variable**        **Formula**                                                               **Output Range**
  ------------------- ------------------------------------------------------------------------- ------------------
  RouteOverlap        Covered segment of passenger route / Total passenger route length         \[0, 1\]

  ScheduleAlignment   1 - (\|departure_diff\| / flex_window)                                    \[0, 1\]

  PreferenceMatch     1 if all hard constraints pass, 0 otherwise                               {0, 1}

  PSGA Score          (w1 x RouteOverlap) + (w2 x ScheduleAlignment) + (w3 x PreferenceMatch)   \[0, 1\]

  FuelShare (PHP)     (DistanceKm / FuelEfficiency) x FuelPricePerLiter / (1 + FilledSeats)     PHP \> 0

  TrustScore          (PrevAvg x TripCount + NewRating) / (TripCount + 1)                       \[1, 5\]
  ----------------------------------------------------------------------------------------------------------------

## Design Phases of the Study {#design-phases-of-the-study .unnumbered}

### **a. Data Pre-Processing Techniques** {#a.-data-pre-processing-techniques .unnumbered}

Trip data submitted by users contains free-text origin and destination entries. Before these enter the matching engine, the system geocodes each address using the Google Maps Geocoding API to produce a standardized latitude-longitude coordinate pair. This normalization step ensures that route overlap computation operates on consistent geographic primitives regardless of how the user typed the address.

Departure time entries are stored in UTC and converted to Philippine Standard Time (UTC+8) at display. All time arithmetic in the PSGA operates in UTC to avoid conversion errors during schedule comparison. Recurrence trip patterns are expanded at query time into individual departure timestamps covering the current academic week. The filter stage evaluates each expanded timestamp independently.

Preference data requires no pre-processing beyond schema validation at input. The co-rider gender field, the Familiar Riders toggle, and the flexibility window are discrete or numeric values stored directly in the user preference table and applied as-is during Stage 2 scoring.

## 3. Development Phases of the Study {#development-phases-of-the-study .unnumbered}

### **a. Modelling and Experimentation** {#a.-modelling-and-experimentation .unnumbered}

The PSGA is modelled and unit-tested in Python before integration into the Node.js backend. Python allows rapid prototyping of the scoring formula, weight calibration experiments, and validation against synthetic trip datasets without the overhead of running the full application stack.

Calibration experiments vary the weights w1, w2, and w3 across a parameter grid. For each weight combination, the algorithm runs against 500 synthetic queries drawn from the validation dataset. The evaluation metric is the proportion of top-ranked results that a human evaluator would consider a valid and preferable match. The weight set producing the highest agreement becomes the production default.

Once unit-tested in Python, the algorithm is re-implemented as a Node.js service module using the same logic. Integration tests compare the output of the Python and Node.js implementations on the same 500 queries to confirm equivalence before deployment.

## 4. Testing Procedure {#testing-procedure .unnumbered}

### **a. Training and Validation of the Algorithm** {#a.-training-and-validation-of-the-algorithm .unnumbered}

Algorithm validation uses a synthetic dataset. Synthetic data is chosen because the platform has no pre-existing user base at the time of evaluation. The dataset contains 500 trip records generated from residential address clusters identified in a Google Maps review of areas within 15 kilometers of Enverga University. Trip departure times follow a bimodal distribution peaking at 7:00 AM and 4:30 PM to reflect typical class schedules.

For each of the 500 synthetic Passenger queries, the PSGA produces a ranked list. A ground truth label is assigned independently by generating oracle matches using full route geometry from the Maps API. Precision at rank 1 measures how often the top PSGA result matches the oracle top result. Recall measures the proportion of oracle-valid trips that the PSGA includes in its filtered candidate set. These two metrics assess Stage 1 and Stage 2 quality independently.

## 5. Quality Requirements and Evaluation of Results {#quality-requirements-and-evaluation-of-results .unnumbered}

This evaluation section is divided into two formally separated streams. The first stream covers Algorithm Quality Evaluation, which assesses the PSGA as an independent computational artifact using the synthetic validation dataset and the oracle-based ground truth. The second stream covers System Quality Evaluation, which assesses the full web application against ISO/IEC 25010 quality characteristics. Keeping the two streams separate ensures that the computational contribution and the software product contribution are each evaluated on their own appropriate criteria and reported with distinct metrics.

RideShareEU is evaluated using the ISO/IEC 25010 Software Product Quality standard. The evaluation covers six quality characteristics. Functional suitability is tested through unit tests on all API endpoints and integration tests on the full registration-to-rating workflow. Jest tests the PSGA service module and all REST routes. Postman validates matching, authentication, notifications, and fuel share endpoints.

Performance efficiency is measured through load tests simulating 200 concurrent users submitting trip searches. Match generation time is benchmarked against the two-second requirement on the target deployment infrastructure.

Usability is measured through a structured User Acceptance Test with a pilot cohort of verified university community members. Participants complete five tasks: register, post a trip, search for a match, approve a join request, and submit a rating. A survey instrument maps each task to ISO/IEC 25010 usability sub-characteristics. Results are analyzed using descriptive statistics.

Security review covers authentication flow correctness, HTTPS enforcement on all tiers, and encryption of personally identifiable fields at rest. Compliance with the Data Privacy Act of 2012 is reviewed as part of the ethics documentation.

Algorithm Quality Evaluation (PSGA-specific)

The PSGA is evaluated as a standalone artifact independently of the web application. Metrics are: precision at rank 1, recall, and mean rank of the first acceptable match. These are measured against the 500-query synthetic dataset using the expert oracle defined in Section 5.1.2.5 (Algorithm Validation). Results are compared against the three baselines --- random ranking, route-only matching, and FIFO --- to establish the marginal contribution of the composite scoring and preference components. Algorithm quality results are reported separately from system quality results in the final thesis document.

## 6. Ethics Consideration {#ethics-consideration .unnumbered}

RideShareEU processes personally identifiable information of university members. Full names, institutional email addresses, route data, and schedule patterns are stored in the system. All data handling follows Republic Act 10173. Personal data is encrypted at rest using AES-256 and in transit over HTTPS using TLS 1.2 or higher. Only matched partners see each other\'s route and schedule details. Unmatched users do not have access to other users\' trip information.

User registration requires acceptance of a terms-of-use agreement stating what data is collected, how it is used, and who can see it. Participation is voluntary. Users delete their accounts and all associated data through the profile settings. No third party receives user data. No institutional passwords are stored. Authentication routes through an OAuth handoff to the ICTD credential system without copying credentials into the RideShareEU database.

User Acceptance Testing participants are voluntary. No participant is required to conduct real trips during evaluation. Test results are reported in aggregate. Individual responses are not attributed to named participants in the thesis document.

### 5.1.3 Description of prototype, where applicable {#description-of-prototype-where-applicable .unnumbered}

The high-fidelity prototype consists of four operational screens covering the core user workflows: Dashboard, My Trips, Notifications, and Profile and Preferences.

![](media/image10.png){width="6.0in" height="3.625in"}**Fig. 9 Dashboard Screen**

The Dashboard is the landing page after login. Two action cards are displayed: Post a Ride opens the trip creation form for hosts, and Find a Ride opens the passenger search interface. An Upcoming Trips panel shows all active trips the user is involved in with route, time, recurrence, seat count, and vehicle details. A Recent Alerts panel shows the latest notifications without requiring navigation away from the home screen.

![](media/image11.png){width="6.0in" height="4.177083333333333in"}**Fig. 10 My Trips Screen**

My Trips organizes all user trips into three tabs: Upcoming, Past, and Cancelled. The Upcoming tab separates trips by role. Host trips are trips the user created. Passenger trips are trips the user joined. Each card shows the full route, departure time, recurrence type, seat availability, and vehicle. View Details opens the full record including passenger lists for hosts and co-rider details for passengers.

![](media/image12.png){width="6.0in" height="4.135416666666667in"}**Fig. 11** Find a Ride Screen

The Find a Ride screen displays a ranked list of compatible carpools for passengers. A sidebar allows users to adjust flexibility windows and gender filters to update search results. The system presents results sorted by the priority-scored greedy algorithm score. Each match card displays the match percentage and current occupancy levels. Passengers use the Join action to send a request and view the estimated fuel share. The interface maintains a two second response time for all search queries.

![](media/image13.png){width="6.0in" height="4.010416666666667in"}**Fig. 12 Post a Ride Screen**

The Post a Ride screen provides Ride Hosts with the interface to submit commute parameters to the matching engine. Hosts enter the origin and destination coordinates via geocoded address fields. The system accepts departure times and recurrence patterns to generate individual trip timestamps. A dedicated section captures vehicle details and seat counts for the fuel share calculation. The Preferences panel applies hard constraints for gender and familiarity during the matching process. A map display shows a route preview based on Google Maps waypoints.

**Figma prototype link:** <https://www.figma.com/make/Gd7t6hxETFjBW0TsgpfSE3/RideShareEU-Web-App-Prototype?t=SMWInsnKtPvpxCGW-1&preview-route=%2Ftrip%2Ft3>

### Development Phases of the System

Development runs in four sequential phases aligned with the continuous Kanban backlog.

**Phase 1: Environment and Authentication.** The team sets up the development environment, designs the database schema, and builds institutional email-based registration with ICTD credential verification. This establishes the identity trust foundation that all other features depend on.

**Phase 2: Core Trip and Matching Modules.** The team builds the trip posting interface for hosts, the search and join interface for passengers, and the PSGA matching engine. Route overlap computation, time window filtering, and preference scoring are tested against sample trip data before integration.

**Phase 3: Notifications, Trust, and Fuel Share.** The notification service handles real-time alerts for requests, approvals, reminders, and rating prompts. The rating module collects post-trip scores and updates user trust profiles. The fuel share calculator computes and displays the per-passenger contribution at match confirmation.

**Phase 4: Integration, Testing, and Deployment.** All modules integrate into the full application. End-to-end testing covers the complete workflow from registration through trip completion and rating. The system deploys to Vercel and cloud backend. A pilot user acceptance test with verified university community members validates the complete experience.

### Testing Procedure and Evaluation Procedure

RideShareEU is evaluated against ISO/IEC 25010, which defines software quality across functional suitability, performance efficiency, usability, reliability, security, and maintainability.

**Functional suitability** is tested through unit tests on individual API endpoints and integration tests on end-to-end workflows. Jest tests the PSGA service module and all API routes. Postman validates the full REST API including matching, authentication, notifications, and fuel share endpoints.

**Performance efficiency** is measured through load testing that simulates concurrent users submitting trip posts and join requests. Match generation response time is benchmarked against the two-second requirement.

**Usability** is measured through a structured User Acceptance Test with a pilot cohort of verified university community members representing student, faculty, and staff roles. Participants complete a task sequence: register, post a trip, search for a match, approve a join request, and submit a rating. A survey instrument maps each task to ISO/IEC 25010 usability sub-characteristics: appropriateness recognizability, learnability, operability, and user error protection. Results are analyzed using descriptive statistics.

**Security** is verified through review of authentication flows, data encryption in transit and at rest, and access control enforcement. Compliance with Republic Act 10173 is part of the ethics review process documented in Section 6. Acceptance Thresholds and Statistical Interpretation: Functional correctness requires a minimum pass rate of 95% across all defined test cases. Usability is measured using the System Usability Scale (SUS) a mean score of 68 or above is the acceptance threshold consistent with industry standard SUS interpretation. Security testing follows an OWASP Top 10 structured checklist applied as a code-based review; all items rated Critical or High must be resolved before evaluation proceeds. Performance testing measures match generation response time at the 95th percentile under a simulated load of 50 concurrent users, with a target of under 2 seconds. Usability survey results are reported as mean SUS score with standard deviation and classified using the standard SUS adjective rating scale. Statistical significance is not claimed for the initial UAT given the bounded pilot sample size; results are treated as indicative and framed accordingly in the evaluation discussion.

### Implementation Plan of the System

RideShareEU deploys on a three-tier cloud architecture. The Next.js frontend deploys on Vercel with automatic HTTPS, continuous deployment from Git, and global CDN. The Node.js API runs on a cloud application server. The database runs on a managed cloud service with automated backups and role-based access control.

![](media/image14.png){width="4.882620297462817in" height="2.9905971128608924in"}

*Fig. 13 Deployment Architecture*

All tiers communicate over HTTPS using RESTful conventions. Users access the system through any modern browser on desktop or mobile without installation. University identity verification connects to ICTD records at registration. No personally identifiable information is stored beyond what is required for trip matching and trust management. All stored data is encrypted at rest.

Practical deployment considerations for the university environment include the following. Database indexing on origin-destination coordinate fields and the departure time field is required to maintain sub-second query performance as the trip pool grows; without indexing, the Stage 1 filter degrades to a full table scan with O(n) cost for every query. The system is designed for a bounded university population estimated at under 10,000 registered users and a peak concurrent request load of under 100 users during morning arrival windows. Scaling beyond these assumptions would require load balancing and read replica configuration, which are outside the current prototype scope. The primary deployment risk specific to a university environment is ICTD integration latency at registration; a fallback verification path using institutional email confirmation is implemented for cases where the live ICTD query is temporarily unavailable.

## CS Thesis Workplan

The workplan below is organized by artifact milestone rather than by calendar phase alone. Each row represents a concrete deliverable that marks the completion of a development stage.

**TABLE V**

  ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  **Project Activities**                                         **Output/ Deliverables**                                                                               **Target Date of Accomplishment**
  -------------------------------------------------------------- ------------------------------------------------------------------------------------------------------ ------------------------------------------
  **Project Activity / Milestone**                               **Deliverable / Output**                                                                               **Target Date**

  **Project Setup and Environment Configuration**                Next.js frontend and Node.js backend environments ready; project repository and structure created      July 15, 2026 -- July 24, 2026

  **Frontend Development -- Login & Verification Screen**        Institutional identity verification UI (University Email/SIS Login) complete                           July 25, 2026 -- August 7, 2026

  **Frontend Development -- Campus Dashboard**                   Main dashboard with active rides, quick search modal, and upcoming trip summary complete               July 25, 2026 -- August 7, 2026

  **Frontend Development -- Ride Posting & Route Screen**        Ride host form for recurring campus trips, departure time windows, and route stops complete            August 8, 2026 -- August 21, 2026

  **Frontend Development -- Ride Matching & Search Screen**      Semicentralized ride search interface with compatibility filters and match score badges complete       August 8, 2026 -- August 21, 2026

  **Frontend Development -- Interactive Campus Route Map**       Interactive map integration showing campus meeting points, route overlap, and driver detour paths      August 22, 2026 -- September 4, 2026

  **Frontend Development -- Trip Details & Fuel-Share Panel**    Trip view modal with suggested fuel-share cost split breakdown and co-rider roster complete            August 22, 2026 -- September 4, 2026

  **Frontend Development -- Notifications & User Profile**       User profile page with stated carpooling preferences and real-time trip notification center complete   August 22, 2026 -- September 4, 2026

  **Database Schema Design and Setup**                           Relational database schema (Users, Vehicles, Routes, Trips, Bookings) and migration scripts ready      September 5, 2026 -- September 11, 2026

  **Algorithm Setup -- Space-Time Clustering Pre-processing**    Logic implemented to group campus commuters by departure time windows and geographic proximity         September 5, 2026 -- September 11, 2026

  **Backend Development -- Institutional Authentication**        Authentication flow and university email verification middleware working                               September 12, 2026 -- September 18, 2026

  **Backend Development -- Trip & Ride Management APIs**         RESTful API endpoints for posting, updating, and querying campus rides complete                        September 12, 2026 -- September 18, 2026

  **Algorithm Development -- PSGA Stage 1 (Route Filter)**       Priority-Scored Greedy Algorithm Stage 1 filtering by route overlap percentage and schedule match      September 12, 2026 -- September 18, 2026

  **Backend Development -- Geocoding & Mapping APIs**            Route geocoding, distance matrix, and detour distance calculation APIs integrated                      September 19, 2026 -- September 25, 2026

  **Backend Development -- Fuel-Share Calculation Engine**       Automated cost-splitting API based on distance and passenger count operational                         September 19, 2026 -- September 25, 2026

  **Backend Development -- Notification & Booking APIs**         Semicentralized ride request, confirmation, and status notification endpoints working                  September 19, 2026 -- September 25, 2026

  **Algorithm Development -- PSGA Stage 2 (Preference Score)**   Priority-Scored Greedy Algorithm Stage 2 ranking candidate matches by user preference scores           September 19, 2026 -- September 25, 2026

  **Algorithm Evaluation & Detour Cost Benchmarking**            Performance report evaluating route overlap accuracy, matching speed, and detour minimization          September 26, 2026 -- October 2, 2026

  **Algorithm Integration with Matching API**                    Completed PSGA engine integrated into the live backend matching recommendation endpoint                September 26, 2026 -- October 2, 2026

  **System Testing (User Story, Black Box, White Box)**          Comprehensive functional, UI, and API test cases completed and documented                              September 26, 2026 -- October 2, 2026

  **Usability & Behavioral Evaluation (TAM / TPB Survey)**       Campus user testing completed; survey data on perceived usefulness, trust, and acceptance validated    September 26, 2026 -- October 2, 2026

  **Align All Manuscript Sections with Completed Application**   Full thesis manuscript (Chapters 1--4) aligned with actual system screenshots, charts, and metrics     October 3, 2026 -- October 9, 2026

  **Final Defense Preparation and Presentation**                 Defense slide deck and live system demo complete; final defense presentation conducted                 October 10, 2026 -- October 30, 2026

  **Revise Manuscript Based on Panel Feedback**                  Revised manuscript incorporating all panel comments and technical recommendations                      October 31, 2026 -- November 6, 2026

  **Create Revision Matrix and Final Submission**                Revision matrix table completed; final hardbound/electronic manuscript submitted                       November 7, 2026 -- November 13, 2026
  ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

# Ethics Consideration

RideShareEU collects and processes personally identifiable information. This includes full names, institutional email addresses, route data, and schedule patterns. All users are verified members of Manuel S. Enverga University Foundation. Access requires valid ICTD credentials, which limits the user base to known, traceable individuals.

The following ethical concerns apply to this study.

Data privacy. The system stores location-related data in the form of origin and destination points. This data is tied to named user accounts. The study follows the Data Privacy Act of 2012 (Republic Act 10173). Personal data is stored using encrypted database fields. Only the matched ride partner receives route and schedule details; no data is exposed to unmatched users.

Informed consent. All users must complete registration and agree to the platform\'s terms before accessing any feature. The registration flow states clearly what data is collected, how it is used, and who sees it. Participation is voluntary. Users withdraw consent by deactivating their account.

Safety and gender sensitivity. The matching engine includes a gender preference filter. Female users set this preference to restrict matches to same-gender hosts or passengers. This addresses the documented safety concern specific to female commuters in Philippine university settings.

Institutional data access. The system authenticates users through ICTD credentials but does not store institutional passwords. Authentication follows an OAuth-based handoff. No student or faculty record from the university registry is copied into the RideShare EU database.

Data minimization. The system collects only the data required for matching and fuel share calculation. No health information, financial account details, or sensitive personal information as defined under RA 10173 is collected.

Testing and UAT ethics. User acceptance testing involves students, faculty, and staff as voluntary participants. No participant is required to complete real trips during evaluation. Test data is anonymized before analysis. Results are reported in aggregate.

Prototype scope and deployment boundaries. The current implementation is a functional prototype intended for academic evaluation within this thesis cycle. Full production deployment at MSEUF would require formal review and approval by the Information and Communications Technology Department (ICTD) to authorize integration with live university identity records. The prototype uses a controlled verification layer during testing and does not connect to live ICTD records during the evaluation phase. Any transition to institutional deployment is outside the scope of this thesis and would require a separate data privacy impact assessment under Republic Act 10173, a formal security review, and written endorsement from the MSEUF administration.

# References

\[1\] S. Kumar, R. Elumalai, and B. Dharshini, \"Transportation Management System (College Bus Locator & Tracker),\" in Proc. IEEE Int. Conf. Emerg. Technol., City, Country, May 2023, pp. 1--5, doi: 10.1109/10040309.

\[2\] L. Mitropoulos, A. Kortsari, and G. Ayfantopoulou, \"Optimized Campus Navigation Using Mobile App: Network Analysis for Effective Route Planning,\" IEEE Trans. Intell. Transp. Syst., vol. 25, no. 1, pp. 1--12, 2025, doi: 10.1109/10823503.

\[3\] N. Alisoltani, Y. Delhoum, M. Ameli, and M. Zargayouna, \"Route Recommendation to Facilitate Carpooling,\" in Proc. IEEE Int. Conf. Intell. Transp. Syst., City, Country, 2022, pp. 1--6, doi: 10.1109/9861101.

\[4\] H.-S. Shyu, D. Huang, and W.-C. Yeh, \"Services-Oriented Computing Using the Compact Genetic Algorithm for Solving the Carpool Services Problem,\" IEEE Syst. J., vol. 10, no. 4, pp. 1536--1547, 2016, doi: 10.1109/7098388.

\[5\] J. Zhang, H. Liu, and Q. Sun, \"A Greedy Algorithm-Based Approach for Dynamic Carpooling Matching and Route Selection,\" in Proc. IEEE Int. Conf. Comput. Commun., City, Country, 2024, pp. 1--6, doi: 10.1109/10566935.

\[6\] Y. Zheng, L. Cao, and C. Zhang, \"Recommendation System for Carpooling and Regular Taxicab Services,\" in Proc. IEEE Int. Conf. Data Min., City, Country, 2017, pp. 1--6, doi: 10.1109/8068628.

\[7\] D. B. S. Dharshini, L. Elumalai, and M. A. Mohamed Aadhil, \"Campus Carpooling: Optimized Ridesharing for Students using Hybrid Ridesharing Algorithm HRA,\" in Proc. IEEE Int. Conf. Comput. Sustain. Global Dev., City, Country, Feb. 2025, pp. 449--454, doi: 10.1109/10962610.

\[8\] A. Lugo, D. Aquino, and M. Bogado, \"Ucarpooling: Decongesting Traffic through Carpooling using Automatic Pairings,\" CLEI Electron. J., vol. 24, no. 2, Art. no. 10, Jul. 2021. \[Online\]. Available: https://clei.org/cleiej/index.php/cleiej/article/view/506 \[Accessed: Aug. 5, 2026\].

\[9\] I. Azkarate-Askasua, J. Llorente, and A. Uriona, \"Electromobility and Carsharing at University of Deusto,\" in Proc. IEEE Int. Conf. Ind. Technol., City, Country, 2014, pp. 1--6, doi: 10.1109/6728512.

\[10\] V. Ramani Bai, G. Satheeshkumar, V. A. Kumar, and S. Sudheeran, \"Enhancing Campus Mobility: EV Sharing Optimization,\" in Proc. IEEE Int. Conf. Emerg. Technol., City, Country, 2025, pp. 1--6, doi: 10.1109/10811944.

\[11\] M. M. Dessouky and S. Hu, \"Dynamic Routing for Ride-Sharing,\" eScholarship, Univ. California, 2021. \[Online\]. Available: https://escholarship.org/uc/item/6qq8r7hz \[Accessed: Aug. 5, 2026\].

\[12\] T. Becker, M. Heinig, and F. Gruber, \"Mobility to Campus -- A Framework to Evaluate and Compare Different Mobility Modes,\" 2025, arXiv:2506.13574. \[Online\]. Available: https://arxiv.org/abs/2506.13574 \[Accessed: Aug. 5, 2026\].

\[13\] C. Scholl, J. Preisig, and T. Weide, \"Digital Mobility Services for Communities: Flexible Boarding Points for Campus Ridesharing,\" in Proc. GI Conf., City, Country, 2024. \[Online\]. Available: https://dl.gi.de/items/96e91ddf-de40-4ae6-b4c2-d5a5d30ce4e2 \[Accessed: Aug. 5, 2026\].

\[14\] N. Masoud, R. Jayakrishnan, and E. Miller, \"Smart Rideshare Matching -- Feasibility of Utilizing Personalized Preferences,\" SmartER Center, Univ. Virginia, Charlottesville, VA, USA, Tech. Rep., 2023. \[Online\]. Available: https://smartercenter.org/projects/smart-rideshare-matching-feasibility-of-utilizing-personalized-preferences/ \[Accessed: Aug. 5, 2026\].

\[15\] Y. Yin, M. Wang, and J. Chen, \"A Systematic Literature Review of Ride-Sharing Platforms, User Factors and Barriers,\" Eur. Transp. Res. Rev., vol. 13, no. 1, p. 36, 2021, doi: 10.1186/s12544-021-00522-1.

\[16\] I. Malode, T. Nagarale, S. Pawar, M. Bagade, and R. Dahake, \"Ridesharing: Web Application for College Students,\" Int. J. Innov. Res. Eng. Multidiscip. Phys. Sci., vol. 11, no. 3, 2023. \[Online\]. Available: https://www.ijirmps.org/papers/2023/3/230182.pdf \[Accessed: Aug. 5, 2026\].

\[17\] M. Rossi, G. Ferrari, and L. Bianchi, \"Car Sharing Profiling at University of Turin,\" Open Access Repository Italy, 2024. \[Online\]. Available: https://www.openaccessrepository.it/record/171742 \[Accessed: Aug. 5, 2026\].

\[18\] J. Zhang, H. Liu, Q. Sun, and F. Wang, \"Multi-Objective Planning of Commuter Carpooling under Time-Varying Road Network,\" Sustainability, vol. 16, no. 2, p. 647, 2024, doi: 10.3390/su16020647.

\[19\] N. Masoud and R. Jayakrishnan, \"A Dynamic Tree Algorithm for Peer-to-Peer Ride-Sharing Matching,\" 2021, arXiv:2105.13078. \[Online\]. Available: https://arxiv.org/abs/2105.13078 \[Accessed: Aug. 5, 2026\].

\[20\] T. Yamashita, K. Nakamura, and H. Suzuki, \"Mathematical Models for Carpooling Considering Driver Absence,\" Comput. Ind. Eng., 2025. \[Online\]. Available: https://tsukuba.repo.nii.ac.jp/record/2020909/files/CIE_210_111577.pdf \[Accessed: Aug. 5, 2026\].

\[21\] Y. Wang, X. Li, and Z. Chen, \"Semicentralized Ride-Matching (SCM) Strategy for Large-Scale Carpooling,\" Transp. Res. Part C Emerg. Technol., vol. 133, p. 103436, 2021, doi: 10.1016/j.trc.2021.103436.

\[22\] M. M. Dessouky, F. Ordóñez, and S. Hu, \"Dynamic Routing for Ride-Sharing: HOV Lanes and Meeting Points,\" U.S. Dept. Transp., Rep. DOT/FTA, 2021. \[Online\]. Available: https://rosap.ntl.bts.gov/view/dot/60189/dot_60189_DS1.pdf \[Accessed: Aug. 5, 2026\].

\[23\] Y. Liu, J. Wang, and X. Zhang, \"Fairness-Aware Dynamic Ride-Hailing Matching Based on Reinforcement Learning,\" IEEE Trans. Intell. Transp. Syst., 2024, Early Access. \[Online\]. Available: https://www.researchgate.net/publication/378271402 \[Accessed: Aug. 5, 2026\].

\[24\] D. B. S. Dharshini, L. Elumalai, and M. A. Mohamed Aadhil, \"Designing a Secure and Efficient Campus Carpooling System: A Comprehensive SRS,\" Preprints, 2025, doi: 10.20944/preprints202503.0991.v1.

\[25\] D. B. S. Dharshini, L. Elumalai, and M. A. Mohamed Aadhil, \"Enhancing Campus Mobility: A Requirement Engineering Approach to a Carpool System for University Students and Staff,\" OASK Publishers, 2025. \[Online\]. Available: https://oaskpublishers.com/assets/article-pdf/enhancing-campus-mobility-a-requirement-engineering-approach-to-a-carpool-system-for-university-students-and-staff.pdf \[Accessed: Aug. 5, 2026\].

\[26\] R. P. Santos, J. M. Cruz, and A. L. Reyes, \"Peer-to-Peer Carpooling: Forging a Path to Sustainable Transportation,\" unpublished working paper, 2025. \[Online\]. Available: https://www.researchgate.net/publication/393398575_Peer-to-Peer_Carpooling_Forging_a_Path_to_Sustainable_Transportation \[Accessed: Aug. 5, 2026\].

\[27\] S. Li, H. Zhang, and Z. Gan, \"Factors Affecting College Students\' Attitudes towards Carpooling,\" Transp. Saf. Environ., vol. 6, no. 2, Art. no. tdad025, 2023, doi: 10.1093/tse/tdad025.

\[28\] E. Kim, J. Park, and S. Lee, \"Understanding Students\' Satisfaction with University Transportation,\" unpublished working paper, 2022. \[Online\]. Available: https://www.researchgate.net/publication/366840641 \[Accessed: Aug. 5, 2026\].

\[29\] L. Chen, M. Wu, and F. Wang, \"A Carpool Matching Model with Both Social and Route Networks,\" unpublished working paper, 2019. \[Online\]. Available: https://www.researchgate.net/publication/332787743 \[Accessed: Aug. 5, 2026\].

\[30\] R. P. Santos, J. M. Cruz, and A. L. Reyes, \"Towards Sustainable Commuting: Development of a Carpool Ride-Sharing Platform with Real-Time Tracking and Safety Features,\" Int. J. Res. Innov. Soc. Sci., vol. 9, no. 1, 2025. \[Online\]. Available: https://rsisinternational.org/journals/ijriss/articles/towards-sustainable-commuting-development-of-a-carpool-ride-sharing-platform-with-real-time-tracking-and-safety-features/ \[Accessed: Aug. 5, 2026\].

\[31\] M. Abouelrous, H. Khalil, and T. Kaur, \"LEAD: Towards Learning-Based Equity-Aware Decarbonization in Ridesharing Platforms,\" 2024, arXiv:2408.10201. \[Online\]. Available: https://arxiv.org/abs/2408.10201 \[Accessed: Aug. 5, 2026\].

\[32\] B. Liu, Y. Zhao, and W. Tang, \"Effect of Ride Sharing on Air Quality: Evidence from Shenzhen,\" J. Chin. Econ. Bus. Stud., vol. 20, no. 2, pp. 150--170, 2022, doi: 10.1080/15140326.2021.2023421.

\[33\] A. Garcia, P. Martinez, and L. Torres, \"Ridesharing and Crowdsourcing for Smart Cities,\" in Proc. IEEE Int. Conf., City, Country, 2023, pp. 1--6, doi: 10.1109/10040639.

\[34\] M. Shaheen, J. Lee, and R. Camel, \"Impact of Environmental Triggers on Students\' Behavior to Use Ride-Sharing Services: The Moderating Role of Perceived Risk,\" Curr. Psychol., vol. 41, pp. 1--15, 2021, doi: 10.1007/s12144-021-02405-z.

\[35\] H. S. Alazemi, N. Al-Rashidi, and M. Al-Mutairi, \"Ridesharing as a Potential Sustainable Transportation Alternative in Suburban Universities: The Case of Najran University, Saudi Arabia,\" Sustainability, vol. 14, no. 8, p. 4392, 2022, doi: 10.3390/su14084392.

\[36\] P. Sharma, A. Gupta, and R. Verma, \"VISHWA-CONNECT: A Ride Sharing Mobile Application for Campus Students,\" Int. J. Res. Appl. Sci. Eng. Technol., vol. 11, no. 5, 2023. \[Online\]. Available: https://www.ijraset.com/best-journal/vishwa-connect-a-ride-sharing-mobile-application \[Accessed: Aug. 5, 2026\].

\[37\] R. Kumar, S. Jain, and A. Mishra, \"POOL: A Peer-to-Peer Ride Sharing App,\" unpublished working paper, 2021. \[Online\]. Available: http://researchgate.net/publication/354201340 \[Accessed: Aug. 5, 2026\].

\[38\] Y. Cheng, L. Zhou, and T. Li, \"A Truthful Subsidy Scheme for a Peer-to-Peer Ridesharing Market with Incomplete Information,\" Transp. Res. Part B Methodol., 2022, Early Access, doi: 10.1016/j.trb.2022.00087X.

\[39\] M. Obi, F. Adeyemi, and C. Eze, \"A Combinatorial Auction-Based Approach for Ridesharing in a Student Transportation System,\" unpublished working paper, 2021. \[Online\]. Available: https://www.researchgate.net/publication/354014191 \[Accessed: Aug. 5, 2026\].

\[40\] T. Adebayo, F. Okonkwo, and C. Nwosu, \"Exploring Shared Travel Behavior of University Students,\" unpublished working paper, 2022. \[Online\]. Available: https://www.researchgate.net/publication/366311827 \[Accessed: Aug. 5, 2026\].

\[41\] A. Muñoz, B. Rodriguez, and C. Alvarez, \"Measuring Students\' Satisfaction Levels for Transit Services: An Application of Latent Class Analysis,\" Case Stud. Transp. Policy, vol. 12, p. 101023, 2023, doi: 10.1016/j.cstp.2023.101023.

\[42\] X. Wang, J. Li, and H. Chen, \"Managing Ridesharing with Incentives in a Bottleneck Model,\" Transp. Res. Part E Logist. Transp. Rev., 2023, Early Access, doi: 10.1016/j.tre.2023.00896.

\[43\] F. Al-Turjman and M. Malekloo, \"Optimizing Ride-Sharing Operations in Smart Sustainable Cities: Challenges and the Need for Agile Algorithms,\" Comput. Ind. Eng., vol. 153, p. 107029, 2021, doi: 10.1016/j.cie.2020.307506.

\[44\] R. Zhao, Y. Liu, and T. Wang, \"Ride-Sharing Matching and Route Planning Based on Adjustable Passenger Pick-Up and Drop-Off Points,\" Transp. Res. Part C Emerg. Technol., 2025, Early Access, doi: 10.1016/j.trc.2025.003985.

\[45\] A. Obi, T. Nakamura, and Y. Sato, \"Space-Time Clustering-Based Method to Optimize Shareability in Real-Time Ride-Sharing,\" unpublished working paper, 2022. \[Online\]. Available: https://www.researchgate.net/publication/357850888 \[Accessed: Aug. 5, 2026\].

\[46\] K. Patel, R. Singh, and D. Mehta, \"SHAREK\*: A Scalable Matching Method for Dynamic Ride Sharing,\" unpublished working paper, 2020. \[Online\]. Available: https://www.researchgate.net/publication/341839527 \[Accessed: Aug. 5, 2026\].

\[47\] C. Huang, D. Zhang, and Y. Si, \"Dynamic Timeframe and Anticipation-Based Migration: A Real-Time Framework for Ride-Sharing,\" unpublished working paper, 2023. \[Online\]. Available: https://www.researchgate.net/publication/375844942 \[Accessed: Aug. 5, 2026\].

\[48\] J. Chen, H. Liu, and F. Wang, \"High-Capacity Ride-Sharing via Shortest Path Clustering on Large Road Networks,\" J. Supercomput., vol. 77, pp. 3078--3101, 2021, doi: 10.1007/s11227-020-03424-6.

\[49\] X. Li, Y. Cheng, and H. Peng, \"A Two-Sided Stable Matching Method in Ridesharing,\" in Proc. IEEE Int. Conf., City, Country, 2023, pp. 1--6, doi: 10.1109/10016360.

\[50\] M. Abouelrous, H. Khalil, and T. Kaur, \"Efficient Algorithms for Community Aware Ridesharing,\" unpublished working paper, 2023. \[Online\]. Available: https://www.researchgate.net/publication/375862540 \[Accessed: Aug. 5, 2026\].

#  Statement of AI Declaration

I declare that the following AI tools were utilized:

**TABLE VI**

+--------------+--------------------------------------------------------------------------------------------------------+-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
| **AI Tools** | **Descriptions of how the information was generated**                                                  | **Prompts Used**                                                                                                                                                                    | **Descriptions of how the output was used in your work**                                                                                                                                                                     |
|              |                                                                                                        |                                                                                                                                                                                     |                                                                                                                                                                                                                              |
| **(1)**      | **(2)**                                                                                                | **(3)**                                                                                                                                                                             | **(4)**                                                                                                                                                                                                                      |
+==============+========================================================================================================+=====================================================================================================================================================================================+==============================================================================================================================================================================================================================+
| Example:     |                                                                                                        |                                                                                                                                                                                     |                                                                                                                                                                                                                              |
+--------------+--------------------------------------------------------------------------------------------------------+-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
| **ChatGPT**  | To refine the introduction's clarity and emphasize the problem's rationale.                            | Here is my draft: enhance the clarity of my write-up, emphasizing the context of the problem.                                                                                       | The output was reviewed line by line and further modified to ensure that my original idea was preserved.                                                                                                                     |
+--------------+--------------------------------------------------------------------------------------------------------+-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
| **ClaudeAI** | To conceptualize the software architecture and define the modular structure of the web application.    | Act as a software architect. Outline a three-tier architecture for a campus carpooling web app using Next.js and Node.js, ensuring the matching algorithm is isolated from the API. | The output served as a structural guide to define our system\'s architecture and design our UML diagrams, which we then modified to specifically fit the Priority-Scored Greedy Algorithm (PSGA).                            |
+--------------+--------------------------------------------------------------------------------------------------------+-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
| **Gemini**   | To audit and correct the manuscript\'s in-text citations and reference list for IEEE style compliance. | Double check if I referenced using IEEE properly. / Can you fix the structural errors in my reference list?                                                                         | The output was reviewed to understand IEEE formatting rules. The generated corrections were applied to fix adjacent in-text brackets, format preprint repositories, and append access dates in the final References section. |
+--------------+--------------------------------------------------------------------------------------------------------+-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------+
